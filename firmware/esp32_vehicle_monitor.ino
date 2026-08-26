#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <Preferences.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

// ============================================================
// 1. KONFIGURASI WIFI & FIREBASE REST API
// ============================================================
const char* ssid     = "GALAXY A33 5G";
const char* password = "cicing77";

// URL Firebase Realtime Database
const char* FIREBASE_HOST = "https://vehicle-monitor-esp32-default-rtdb.asia-southeast1.firebasedatabase.app";

// ============================================================
// 2. PIN CONFIGURATION (ESP32-C3)
// ============================================================
#define GPS_RX_PIN   20   // ESP32-C3 RX <-- NEO-6M TX
#define GPS_TX_PIN   21   // ESP32-C3 TX --> NEO-6M RX
#define GPS_BAUD     9600

#define OLED_SDA_PIN 5
#define OLED_SCL_PIN 6
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_ADDR    0x3C

#define GREEN_LED_PIN  3
#define ORANGE_LED_PIN 4

// ============================================================
// 3. PARAMETER & TIMING NON-BLOCKING
// ============================================================
#define DEFAULT_SPEED_LIMIT      60.0
#define INITIAL_ODO_KM           97000.0
#define MIN_MOVE_METERS          2.0
#define UTC_OFFSET_HOURS         7

#define OLED_UPDATE_INTERVAL_MS  100     // Refresh rate OLED 10 FPS
#define LED_BLINK_INTERVAL_MS    300
#define WEB_SEND_INTERVAL_MS     1000    // Kirim data ke Web tiap 1 detik
#define WEB_SYNC_INTERVAL_MS     2500    // Cek limit dari web tiap 2.5 detik
#define DEBUG_PRINT_INTERVAL_MS  1000

#define ODO_SAVE_DISTANCE_KM     0.5
#define ODO_SAVE_INTERVAL_MS     60000UL

// ============================================================
// 4. OBJEK GLOBAL
// ============================================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Preferences preferences;

// ============================================================
// 5. STATE GLOBAL
// ============================================================
double speedLimit      = DEFAULT_SPEED_LIMIT;
double odoKm           = INITIAL_ODO_KM;
double tripKm          = 0.0;
double currentSpeed    = 0.0;
bool   gpsFix          = false;
bool   overSpeedActive = false;

double lastLat = 0.0;
double lastLng = 0.0;
bool   hasLastPosition = false;

double odoAtLastSave = INITIAL_ODO_KM;
unsigned long lastOdoSaveMs = 0;

unsigned long lastOledUpdateMs = 0;
unsigned long lastBlinkMs      = 0;
unsigned long lastWebSendMs    = 0;
unsigned long lastWebSyncMs    = 0;
bool blinkState = false;

int  wibDay = 1, wibMonth = 1, wibYear = 2026;
int  wibHour = 0, wibMinute = 0, wibSecond = 0;
bool dateTimeValid = false;
bool timeSyncStarted = false;

const char* MONTH_NAMES[] = {
  "JAN","FEB","MAR","APR","MEI","JUN",
  "JUL","AGU","SEP","OKT","NOV","DES"
};

// ============================================================
// 6. NTP TIME SYNC (INSTAN REAL-TIME DARI INTERNET / WIB)
// ============================================================
void startTimeSync() {
    if (timeSyncStarted) return;
    // GMT+7 (7 * 3600 detik) untuk WIB
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com", "id.pool.ntp.org");
    timeSyncStarted = true;
    Serial.println(F("[TIME] NTP Time Sync Dimulai (GMT+7 WIB)..."));
}

int daysInMonth(int month, int year) {
    static const int table[] = {31,28,31,30,31,30,31,31,30,31,30,31};
    if (month == 2) {
        bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        return leap ? 29 : 28;
    }
    return table[month - 1];
}

void updateDateTime() {
    // 1. Prioritas Utama: NTP Internet Clock (Presisi Detik & Pasti Realtime)
    time_t now = time(nullptr);
    if (now > 1700000000) { // Waktu epoch valid (tahun > 2023)
        struct tm timeinfo;
        localtime_r(&now, &timeinfo);
        wibYear   = timeinfo.tm_year + 1900;
        wibMonth  = timeinfo.tm_mon + 1;
        wibDay    = timeinfo.tm_mday;
        wibHour   = timeinfo.tm_hour;
        wibMinute = timeinfo.tm_min;
        wibSecond = timeinfo.tm_sec;
        dateTimeValid = true;
        return;
    }

    // 2. Fallback: GPS Atomic Clock (Jika tidak ada koneksi internet)
    if (gps.time.isValid() && gps.date.isValid() && gps.date.year() >= 2024) {
        int hour  = gps.time.hour() + UTC_OFFSET_HOURS;
        int day   = gps.date.day();
        int month = gps.date.month();
        int year  = gps.date.year();

        if (hour >= 24) {
            hour -= 24;
            day += 1;
            int maxDay = daysInMonth(month, year);
            if (day > maxDay) {
                day = 1;
                month += 1;
                if (month > 12) {
                    month = 1;
                    year += 1;
                }
            }
        }

        wibHour   = hour;
        wibMinute = gps.time.minute();
        wibSecond = gps.time.second();
        wibDay    = day;
        wibMonth  = month;
        wibYear   = year;
        dateTimeValid = true;
    }
}

// ============================================================
// 7. WIFI STATE MANAGEMENT (SUPER CEPAT & NON-BLOCKING)
// ============================================================
enum WifiState { WIFI_IDLE, WIFI_CONNECTING, WIFI_CONNECTED };
WifiState wifiState = WIFI_IDLE;
unsigned long wifiStart = 0;
unsigned long wifiRetry = 0;
unsigned long dotTimer  = 0;

void startWifi() {
    Serial.println("\n[WIFI] Menghubungkan ke: " + String(ssid));
    WiFi.disconnect(true);
    delay(40);

    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);              // Latensi instan
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
    WiFi.setTxPower(WIFI_POWER_11dBm); // Cegah drop tegangan

    WiFi.begin(ssid, password);
    wifiStart = millis();
    dotTimer  = millis();
    wifiState = WIFI_CONNECTING;
}

void updateWifi() {
    switch (wifiState) {
        case WIFI_IDLE:
            if (millis() - wifiRetry > 2000) startWifi();
            break;

        case WIFI_CONNECTING:
            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("\n[WIFI] TERHUBUNG CEPAT!");
                Serial.print("[WIFI] IP: ");
                Serial.println(WiFi.localIP());
                wifiState = WIFI_CONNECTED;
                startTimeSync(); // Langsung sync jam WIB real-time
            } else {
                if (millis() - dotTimer > 500) {
                    Serial.print(".");
                    dotTimer = millis();
                }
                if (millis() - wifiStart > 10000) {
                    Serial.println("\n[WIFI] Timeout. Ulangi...");
                    WiFi.disconnect(true);
                    wifiState = WIFI_IDLE;
                    wifiRetry = millis();
                }
            }
            break;

        case WIFI_CONNECTED:
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("\n[WIFI] Terputus! Reconnecting...");
                wifiState = WIFI_IDLE;
                wifiRetry = millis();
                timeSyncStarted = false;
            }
            break;
    }
}

// ============================================================
// 8. KOMUNIKASI RINGAN KE FIREBASE WEB (REST API - ZERO LAG)
// ============================================================
void sendTelemetryToWeb() {
    if (wifiState != WIFI_CONNECTED) return;

    unsigned long now = millis();
    if (now - lastWebSendMs < WEB_SEND_INTERVAL_MS) return;
    lastWebSendMs = now;

    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String url = String(FIREBASE_HOST) + "/vehicle/current.json";
    
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(1200);

    char timeStr[12], dateStr[16];
    if (dateTimeValid) {
        snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d", wibYear, wibMonth, wibDay);
        snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", wibHour, wibMinute, wibSecond);
    } else {
        snprintf(dateStr, sizeof(dateStr), "--");
        snprintf(timeStr, sizeof(timeStr), "--:--:--");
    }

    String json = "{";
    json += "\"speed\":" + String((int)(currentSpeed + 0.5)) + ",";
    json += "\"rawSpeed\":" + String(currentSpeed, 1) + ",";
    json += "\"odo\":" + String((long)odoKm) + ",";
    json += "\"trip\":" + String(tripKm, 2) + ",";
    json += "\"speedLimit\":" + String((int)speedLimit) + ",";
    json += "\"gps\":\"" + String(gpsFix ? "Connected" : "No Signal") + "\",";
    json += "\"esp32\":\"Online\",";
    json += "\"status\":\"" + String(overSpeedActive ? "Warning" : "Normal") + "\",";
    json += "\"date\":\"" + String(dateStr) + "\",";
    json += "\"time\":\"" + String(timeStr) + "\",";
    json += "\"lastUpdate\":\"" + String(timeStr) + "\",";
    json += "\"lat\":" + String(gps.location.lat(), 6) + ",";
    json += "\"lng\":" + String(gps.location.lng(), 6) + ",";
    json += "\"satellites\":" + String(gps.satellites.value());
    json += "}";

    http.PATCH(json);
    http.end();
}

void syncSpeedLimitFromWeb() {
    if (wifiState != WIFI_CONNECTED) return;

    unsigned long now = millis();
    if (now - lastWebSyncMs < WEB_SYNC_INTERVAL_MS) return;
    lastWebSyncMs = now;

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    String url = String(FIREBASE_HOST) + "/settings/speedLimit.json";
    
    http.begin(client, url);
    http.setTimeout(1200);

    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        int newLimit = payload.toInt();
        if (newLimit >= 20 && newLimit <= 180 && newLimit != (int)speedLimit) {
            speedLimit = (double)newLimit;
            Serial.printf("[WEB] Speed Limit updated: %.0f KM/H\n", speedLimit);
        }
    }
    http.end();
}

// ============================================================
// 9. GPS & SPEED
// ============================================================
void readGPS() {
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }
}

void updateSpeed() {
    gpsFix = gps.location.isValid() && gps.speed.isValid();
    currentSpeed = gpsFix ? gps.speed.kmph() : 0.0;
}

void updateTripAndOdo() {
    if (!gps.location.isValid() || !gps.location.isUpdated()) return;

    double curLat = gps.location.lat();
    double curLng = gps.location.lng();

    if (!hasLastPosition) {
        lastLat = curLat;
        lastLng = curLng;
        hasLastPosition = true;
        return;
    }

    double distanceM = TinyGPSPlus::distanceBetween(lastLat, lastLng, curLat, curLng);
    if (distanceM >= MIN_MOVE_METERS) {
        double distanceKm = distanceM / 1000.0;
        tripKm += distanceKm;
        odoKm  += distanceKm;
        lastLat = curLat;
        lastLng = curLng;
        maybeSaveOdo();
    }
}

void loadOdo() {
    odoKm = preferences.getDouble("odoKm", INITIAL_ODO_KM);
    odoAtLastSave = odoKm;
}

void saveOdo() {
    preferences.putDouble("odoKm", odoKm);
    odoAtLastSave = odoKm;
    lastOdoSaveMs = millis();
    Serial.println(F("[ODO] Tersimpan ke flash."));
}

void maybeSaveOdo() {
    if ((odoKm - odoAtLastSave) >= ODO_SAVE_DISTANCE_KM || (millis() - lastOdoSaveMs) >= ODO_SAVE_INTERVAL_MS) {
        saveOdo();
    }
}

void updateWarning() {
    overSpeedActive = gpsFix && (currentSpeed > speedLimit);
}

void updateLED() {
    if (!overSpeedActive) {
        digitalWrite(GREEN_LED_PIN, HIGH);
        digitalWrite(ORANGE_LED_PIN, LOW);
        return;
    }
    digitalWrite(GREEN_LED_PIN, LOW);
    if (millis() - lastBlinkMs >= LED_BLINK_INTERVAL_MS) {
        lastBlinkMs = millis();
        blinkState = !blinkState;
        digitalWrite(ORANGE_LED_PIN, blinkState ? HIGH : LOW);
    }
}

// ============================================================
// 10. OLED DISPLAY (DENGAN JAM & TANGGAL REALTIME)
// ============================================================
void printCentered(const char* text, int y, int textSize) {
    display.setTextSize(textSize);
    int16_t x1, y1; uint16_t w, h;
    display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
    int x = (SCREEN_WIDTH - (int)w) / 2;
    if (x < 0) x = 0;
    display.setCursor(x, y);
    display.print(text);
}

void updateOLED() {
    if (millis() - lastOledUpdateMs < OLED_UPDATE_INTERVAL_MS) return;
    lastOledUpdateMs = millis();

    display.clearDisplay();

    // Baris Header: Tanggal, Indikator WiFi & Jam Menit Detik
    display.setTextSize(1);
    char dateStr[14], timeStr[10];
    if (dateTimeValid) {
        snprintf(dateStr, sizeof(dateStr), "%d %s", wibDay, MONTH_NAMES[wibMonth - 1]);
        snprintf(timeStr, sizeof(timeStr), "%02d:%02d", wibHour, wibMinute);
    } else {
        snprintf(dateStr, sizeof(dateStr), "-- ---");
        snprintf(timeStr, sizeof(timeStr), "--:--");
    }
    display.setCursor(0, 0);
    display.print(dateStr);

    if (wifiState == WIFI_CONNECTED) {
        display.setCursor(52, 0);
        display.print("WEB:OK");
    }

    int16_t x1, y1; uint16_t w, h;
    display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
    display.setCursor(SCREEN_WIDTH - w, 0);
    display.print(timeStr);

    // Kecepatan
    if (!(overSpeedActive && !blinkState)) {
        char speedStr[6];
        if (gpsFix) snprintf(speedStr, sizeof(speedStr), "%d", (int)(currentSpeed + 0.5));
        else snprintf(speedStr, sizeof(speedStr), "--");
        printCentered(speedStr, 16, 4);
    }

    printCentered(gpsFix ? "KM/H" : "NO GPS", 47, 1);

    // ODO & TRIP
    char odoStr[20], tripStr[20];
    snprintf(odoStr, sizeof(odoStr), "ODO %ld", (long)odoKm);
    snprintf(tripStr, sizeof(tripStr), "TRIP %.1f", tripKm);
    display.setCursor(0, 56);
    display.print(odoStr);
    display.getTextBounds(tripStr, 0, 0, &x1, &y1, &w, &h);
    display.setCursor(SCREEN_WIDTH - w, 56);
    display.print(tripStr);

    display.display();
}

// ============================================================
// 11. SETUP & MAIN LOOP
// ============================================================
void setup() {
    Serial.begin(115200);

    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(ORANGE_LED_PIN, OUTPUT);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(ORANGE_LED_PIN, LOW);

    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
    display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.display();

    preferences.begin("speedo", false);
    loadOdo();

    Serial.println(F("=== SPEEDOMETER & REALTIME NTP CLOCK READY ==="));

    wifiRetry = millis() - 2000;
    wifiState = WIFI_IDLE;
}

void loop() {
    updateWifi();
    readGPS();
    updateSpeed();
    updateTripAndOdo();
    updateDateTime();
    updateWarning();
    updateLED();
    updateOLED();

    sendTelemetryToWeb();
    syncSpeedLimitFromWeb();

    yield();
}
