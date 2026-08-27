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
#define GPS_RX_PIN     20   // ESP32-C3 RX <-- NEO-6M TX
#define GPS_TX_PIN     21   // ESP32-C3 TX --> NEO-6M RX
#define GPS_BAUD       9600

#define OLED_SDA_PIN   5
#define OLED_SCL_PIN   6
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64
#define OLED_ADDR      0x3C
#define OLED_RESET_PIN -1

#define GREEN_LED_PIN  3    // LED Hijau (Normal Status)
#define ORANGE_LED_PIN 4    // LED Oren (Warning / Flash Test)

// ============================================================
// 3. PARAMETER & KALIBRASI ODOMETER 97248 KM
// ============================================================
#define DEFAULT_SPEED_LIMIT      60.0
#define INITIAL_ODO_KM           97248.0   // Nilai target ODO 97,248 KM
#define UTC_OFFSET_HOURS         7

#define OLED_UPDATE_INTERVAL_MS  100     // Refresh rate OLED 10 FPS (100ms)
#define LED_BLINK_INTERVAL_MS    175     // Kecepatan kedip LED Warning
#define WEB_SEND_INTERVAL_MS     1000    // Kirim telemetri ke Web tiap 1 detik
#define WEB_SYNC_INTERVAL_MS     2500    // Cek limit & perintah tiap 2.5 detik

#define ODO_SAVE_DISTANCE_KM     0.5     // Simpan ke Flash tiap 500 meter
#define ODO_SAVE_INTERVAL_MS     60000UL // Simpan ke Flash maksimal tiap 60 detik

// ============================================================
// 4. OBJEK GLOBAL & CLIENT
// ============================================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);
Preferences preferences;
WiFiClientSecure firebaseClient;

// ============================================================
// 5. STATE GLOBAL & THREAD-SAFE VARIABLES
// ============================================================
portMUX_TYPE dataMux = portMUX_INITIALIZER_UNLOCKED;

volatile double speedLimit      = DEFAULT_SPEED_LIMIT;
volatile double odoKm           = INITIAL_ODO_KM;
volatile double tripKm          = 0.0;
volatile double currentSpeed    = 0.0;
volatile bool   gpsFix          = false;
volatile bool   overSpeedActive = false;

// State kendali Flash Test LED Oren (Pin 4)
volatile bool   flashTestActive = false;
volatile unsigned long flashTestEndMs = 0;

// State filter gerak & koordinat
bool   isMoving             = false;
int    glitchCount          = 0;
double lastLat              = 0.0;
double lastLng              = 0.0;
bool   hasLastPosition      = false;

double odoAtLastSave        = INITIAL_ODO_KM;
unsigned long lastOdoSaveMs = 0;

unsigned long lastOledUpdateMs  = 0;
unsigned long lastBlinkMs       = 0;
unsigned long lastValidSpeedMs  = 0;
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
// 6. WIFI & NETWORK STATE MANAGEMENT
// ============================================================
enum WifiState { WIFI_IDLE, WIFI_CONNECTING, WIFI_CONNECTED };
volatile WifiState wifiState = WIFI_IDLE;
unsigned long wifiStart = 0;
unsigned long wifiRetry = 0;
unsigned long dotTimer  = 0;

void telemetryTask(void *pvParameters);

// ============================================================
// 7. NTP TIME SYNC (WIB GMT+7)
// ============================================================
void startTimeSync() {
    if (timeSyncStarted) return;
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com", "id.pool.ntp.org");
    timeSyncStarted = true;
    Serial.println(F("[TIME] NTP Time Sync Dimulai (GMT+7 WIB)..."));
}

int daysInMonth(int month, int year) {
    static const int table[] = {31,28,31,30,31,30,31,30,31,30,31,30,31};
    if (month == 2) {
        bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        return leap ? 29 : 28;
    }
    return table[month - 1];
}

void updateDateTime() {
    time_t now = time(nullptr);
    if (now > 1700000000) { // Valid Epoch NTP time
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
// 8. ODOMETER PERSISTENCE & KALIBRASI 97248 KM (ANTI-SALAH)
// ============================================================
void loadOdo() {
    preferences.begin("speedo", false);
    
    // Cek nilai tersimpan di flash: jika di bawah 97248 km (seperti data 97022 lama), hapus total!
    double storedOdo = preferences.getDouble("odoKm", 0.0);
    if (storedOdo < 97248.0 || storedOdo > 5000000.0 || isnan(storedOdo)) {
        odoKm = INITIAL_ODO_KM;
        preferences.putDouble("odoKm", odoKm);
        Serial.printf("[ODO] *** FLASH RESET: Nilai lama dihapus -> ODO baru: %.1f KM ***\n", odoKm);
    } else {
        odoKm = storedOdo;
        Serial.printf("[ODO] Memuat ODO dari Flash: %.1f KM\n", odoKm);
    }
    odoAtLastSave = odoKm;
}

void saveOdo() {
    portENTER_CRITICAL(&dataMux);
    double curOdo = odoKm;
    portEXIT_CRITICAL(&dataMux);

    preferences.putDouble("odoKm", curOdo);
    odoAtLastSave = curOdo;
    lastOdoSaveMs = millis();
    Serial.printf("[ODO] Tersimpan ke Flash: %.2f KM\n", curOdo);
}

void maybeSaveOdo() {
    if ((odoKm - odoAtLastSave) >= ODO_SAVE_DISTANCE_KM || (millis() - lastOdoSaveMs) >= ODO_SAVE_INTERVAL_MS) {
        saveOdo();
    }
}

// ============================================================
// 9. GPS KONFIGURASI STABIL & FILTER KECEPATAN ANTI-SPIKE
// ============================================================
void configureGPS() {
    // 1. Set update rate ke 2Hz (500ms) - Sempurna untuk 9600 baud, bebas overflow & tanpa buffer drop!
    const uint8_t ubx2Hz[] = {
        0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xF4, 0x01, 0x01, 0x00, 0x01, 0x00, 0x0B, 0x77
    };
    // 2. Set dynamic platform model ke Automotive (Model 4) untuk filter gerak kendaraan optimal
    const uint8_t ubxAutomotive[] = {
        0xB5, 0x62, 0x06, 0x24, 0x24, 0x00, 0xFF, 0xFF, 0x04, 0x03, 0x00, 0x00, 0x00, 0x00, 0x10, 0x27,
        0x00, 0x00, 0x05, 0x00, 0xFA, 0x00, 0xFA, 0x00, 0x64, 0x00, 0x2C, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0xDC
    };
    gpsSerial.write(ubx2Hz, sizeof(ubx2Hz));
    delay(50);
    gpsSerial.write(ubxAutomotive, sizeof(ubxAutomotive));
    delay(50);
    Serial.println(F("[GPS] NEO-6M Mode Otomotif 2Hz Aktif (Stabil, Bebas Spike, Sangat Akurat)!"));
}

void readGPS() {
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }
}

void updateSpeed() {
    // Cek kelayakan data kecepatan GPS & minimal 4 satelit
    if (gps.speed.isValid() && gps.speed.age() < 1500 && gps.satellites.value() >= 4) {
        double rawKmph = gps.speed.kmph();

        // 1. REJECT GLITCH MUSTAHIL (> 180 km/h)
        if (rawKmph > 180.0 || isnan(rawKmph)) {
            return;
        }

        // 2. DEADBAND FILTER SAAT MOBIL DIAM
        // Di bawah 2.0 km/h dikunci bersih 0.0 km/h
        if (rawKmph < 2.0) {
            currentSpeed = 0.0;
            isMoving = false;
            glitchCount = 0;
        } else {
            // 3. ANTI-SPIKE ACCELERATION GUARD:
            // Dari kondisi diam (0 km/h), mobil tidak mungkin mendadak melonjak > 18 km/h dalam 1 frame
            if (!isMoving && rawKmph > 18.0) {
                glitchCount++;
                if (glitchCount < 2) {
                    // Abaikan lonjakan glitch frame pertama
                    return;
                }
            }
            glitchCount = 0;

            // 4. RESPON CEPAT & SMOOTH
            if (!isMoving) {
                currentSpeed = rawKmph; // Start moving
                isMoving = true;
            } else {
                // Low-pass exponential smoothing (60% previous + 40% new) untuk pergerakan stabil tanpa jitter
                currentSpeed = (currentSpeed * 0.6) + (rawKmph * 0.4);
            }
        }
        lastValidSpeedMs = millis();
        gpsFix = true;
    } else if (millis() - lastValidSpeedMs < 1200 && isMoving && currentSpeed >= 3.0) {
        // Grace period singkat (1.2 detik) saat melaju jika ada 1 frame NMEA drop
        gpsFix = (gps.satellites.value() >= 4);
    } else {
        currentSpeed = 0.0;
        isMoving = false;
        glitchCount = 0;
        gpsFix = (gps.satellites.value() >= 4) || (gps.location.isValid() && gps.location.age() < 2500);
    }
}

void updateTripAndOdo() {
    // KUNCI JARAK saat kendaraan diam (kecepatan 0 atau tidak ada GPS fix)
    // TRIP & ODO tidak akan bertambah 1 milimeter pun saat parkir!
    if (!isMoving || !gpsFix || currentSpeed < 2.0) {
        if (gps.location.isValid()) {
            lastLat = gps.location.lat();
            lastLng = gps.location.lng();
            hasLastPosition = true;
        }
        return;
    }

    // SAAT KENDARAAN MELAJU: Hitung jarak perpindahan koordinat presisi tinggi
    if (gps.location.isValid() && gps.location.isUpdated()) {
        double curLat = gps.location.lat();
        double curLng = gps.location.lng();

        if (!hasLastPosition) {
            lastLat = curLat;
            lastLng = curLng;
            hasLastPosition = true;
            return;
        }

        double distanceM = TinyGPSPlus::distanceBetween(lastLat, lastLng, curLat, curLng);
        // Validasi fisik: jarak per update (0.4 meter s/d 60 meter)
        if (distanceM >= 0.4 && distanceM <= 60.0) {
            double distanceKm = distanceM / 1000.0;

            portENTER_CRITICAL(&dataMux);
            tripKm += distanceKm;
            odoKm  += distanceKm;
            portEXIT_CRITICAL(&dataMux);

            lastLat = curLat;
            lastLng = curLng;
            maybeSaveOdo();
        }
    }
}

void updateWarning() {
    overSpeedActive = gpsFix && (currentSpeed > speedLimit);
}

void updateLED() {
    bool isWarning = overSpeedActive;

    // Kendali non-blocking untuk Flash Test LED Oren
    if (flashTestActive) {
        if (millis() < flashTestEndMs) {
            isWarning = true;
        } else {
            flashTestActive = false;
            Serial.println(F("[FLASH TEST] Selesai otomatis."));
        }
    }

    if (!isWarning) {
        digitalWrite(GREEN_LED_PIN, HIGH);
        digitalWrite(ORANGE_LED_PIN, LOW);
        return;
    }

    // Warning Mode / Flash Test: LED Hijau Mati, LED Oren Berkedip
    digitalWrite(GREEN_LED_PIN, LOW);
    if (millis() - lastBlinkMs >= LED_BLINK_INTERVAL_MS) {
        lastBlinkMs = millis();
        blinkState = !blinkState;
        digitalWrite(ORANGE_LED_PIN, blinkState ? HIGH : LOW);
    }
}

// ============================================================
// 10. OLED DISPLAY (DASHBOARD HUD OTOMOTIF 128x64)
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

    // ----------------------------------------------------
    // BARIS HEADER (y = 0 s/d 9)
    // ----------------------------------------------------
    display.setTextSize(1);
    char dateStr[14], timeStr[10];
    if (dateTimeValid) {
        snprintf(dateStr, sizeof(dateStr), "%d %s", wibDay, MONTH_NAMES[wibMonth - 1]);
        snprintf(timeStr, sizeof(timeStr), "%02d:%02d", wibHour, wibMinute);
    } else {
        snprintf(dateStr, sizeof(dateStr), "-- ---");
        snprintf(timeStr, sizeof(timeStr), "--:--");
    }

    // Tanggal di Kiri
    display.setCursor(0, 0);
    display.print(dateStr);

    // Status Network di Tengah
    if (flashTestActive) {
        display.setCursor(44, 0);
        display.print("[TEST]");
    } else if (wifiState == WIFI_CONNECTED) {
        display.setCursor(50, 0);
        display.print("LIVE");
    } else if (wifiState == WIFI_CONNECTING) {
        display.setCursor(44, 0);
        display.print("WIFI..");
    } else {
        display.setCursor(44, 0);
        display.print("NO NET");
    }

    // Jam di Kanan
    int16_t x1, y1; uint16_t w, h;
    display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
    display.setCursor(SCREEN_WIDTH - w, 0);
    display.print(timeStr);

    // Garis pemisah header
    display.drawFastHLine(0, 9, SCREEN_WIDTH, SSD1306_WHITE);

    // ----------------------------------------------------
    // SPEEDOMETER TENGAH (y = 13 s/d 48)
    // ----------------------------------------------------
    if (!(overSpeedActive && !blinkState)) {
        char speedStr[6];
        if (gpsFix) {
            int displaySpeed = (currentSpeed >= 2.0) ? (int)(currentSpeed + 0.5) : 0;
            snprintf(speedStr, sizeof(speedStr), "%d", displaySpeed);
        } else {
            snprintf(speedStr, sizeof(speedStr), "--");
        }
        printCentered(speedStr, 13, 4);
    }

    // Sub-title / Status Satelit / Warning
    if (flashTestActive) {
        printCentered("[ FLASH TEST ]", 44, 1);
    } else if (overSpeedActive) {
        printCentered("! SPEED WARNING !", 44, 1);
    } else if (gpsFix) {
        char satStr[24];
        snprintf(satStr, sizeof(satStr), "KM/H  SAT: %d", gps.satellites.value());
        printCentered(satStr, 44, 1);
    } else {
        printCentered("SEARCHING GPS...", 44, 1);
    }

    // Garis pemisah footer
    display.drawFastHLine(0, 53, SCREEN_WIDTH, SSD1306_WHITE);

    // ----------------------------------------------------
    // BARIS FOOTER (y = 55 s/d 63) - ODO & TRIP
    // ----------------------------------------------------
    char odoStr[20], tripStr[20];
    snprintf(odoStr, sizeof(odoStr), "ODO %ld", (long)(odoKm + 0.5));
    if (tripKm < 10.0) {
        snprintf(tripStr, sizeof(tripStr), "TRIP %.2f", tripKm);
    } else {
        snprintf(tripStr, sizeof(tripStr), "TRIP %.1f", tripKm);
    }

    display.setCursor(0, 56);
    display.print(odoStr);

    display.getTextBounds(tripStr, 0, 0, &x1, &y1, &w, &h);
    display.setCursor(SCREEN_WIDTH - w, 56);
    display.print(tripStr);

    display.display();
}

// ============================================================
// 11. KOMUNIKASI CLOUD FIREBASE (NON-BLOCKING BACKGROUND WORKER)
// ============================================================
void sendTelemetryToWeb() {
    if (wifiState != WIFI_CONNECTED) return;

    HTTPClient http;
    String url = String(FIREBASE_HOST) + "/vehicle/current.json";
    
    http.begin(firebaseClient, url);
    http.setReuse(true);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(900);

    char timeStr[12], dateStr[16];
    if (dateTimeValid) {
        snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d", wibYear, wibMonth, wibDay);
        snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", wibHour, wibMinute, wibSecond);
    } else {
        snprintf(dateStr, sizeof(dateStr), "--");
        snprintf(timeStr, sizeof(timeStr), "--:--:--");
    }

    portENTER_CRITICAL(&dataMux);
    double curSpd    = currentSpeed;
    double curOdo    = odoKm;
    double curTrip   = tripKm;
    double curLimit  = speedLimit;
    bool isOverSpeed = overSpeedActive;
    bool isFlash     = flashTestActive;
    bool isFix       = gpsFix;
    portEXIT_CRITICAL(&dataMux);

    int sendSpeed = (curSpd >= 2.0) ? (int)(curSpd + 0.5) : 0;
    double sendRawSpeed = (curSpd >= 2.0) ? curSpd : 0.0;

    String json = "{";
    json += "\"speed\":" + String(sendSpeed) + ",";
    json += "\"rawSpeed\":" + String(sendRawSpeed, 1) + ",";
    json += "\"odo\":" + String((long)(curOdo + 0.5)) + ",";
    json += "\"trip\":" + String(curTrip, 2) + ",";
    json += "\"speedLimit\":" + String((int)curLimit) + ",";
    json += "\"gps\":\"" + String(isFix ? "Connected" : "No Signal") + "\",";
    json += "\"esp32\":\"Online\",";
    json += "\"status\":\"" + String((isOverSpeed || isFlash) ? "Warning" : "Normal") + "\",";
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

void syncCommandsFromWeb() {
    if (wifiState != WIFI_CONNECTED) return;

    HTTPClient http;

    // 1. Sync Speed Limit dari Web
    String limitUrl = String(FIREBASE_HOST) + "/settings/speedLimit.json";
    http.begin(firebaseClient, limitUrl);
    http.setReuse(true);
    http.setTimeout(800);

    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        int newLimit = payload.toInt();
        if (newLimit >= 20 && newLimit <= 180 && newLimit != (int)speedLimit) {
            portENTER_CRITICAL(&dataMux);
            speedLimit = (double)newLimit;
            portEXIT_CRITICAL(&dataMux);
            Serial.printf("[WEB] Speed Limit updated: %.0f KM/H\n", speedLimit);
        }
    }
    http.end();

    // 2. Sync Flash Test Command (Pin 4 Orange LED)
    String flashUrl = String(FIREBASE_HOST) + "/commands/flashTest.json";
    http.begin(firebaseClient, flashUrl);
    http.setReuse(true);
    http.setTimeout(800);

    httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        if (payload.indexOf("\"active\":true") >= 0 || payload.indexOf("\"active\": true") >= 0) {
            if (!flashTestActive) {
                int duration = 5000;
                int durIdx = payload.indexOf("\"duration\":");
                if (durIdx >= 0) {
                    duration = payload.substring(durIdx + 11).toInt();
                    if (duration <= 0 || duration > 30000) duration = 5000;
                }
                portENTER_CRITICAL(&dataMux);
                flashTestActive = true;
                flashTestEndMs = millis() + duration;
                portEXIT_CRITICAL(&dataMux);
                Serial.printf("[WEB] Flash Test AKTIF: %d ms (Pin 4 LED Oren)\n", duration);
            }
        } else if (payload.indexOf("\"active\":false") >= 0 || payload.indexOf("\"active\": false") >= 0) {
            if (flashTestActive) {
                portENTER_CRITICAL(&dataMux);
                flashTestActive = false;
                portEXIT_CRITICAL(&dataMux);
                Serial.println(F("[WEB] Flash Test dihentikan dari Web."));
            }
        }
    }
    http.end();

    // 3. Sync Reset Trip Command dari Web
    String resetTripUrl = String(FIREBASE_HOST) + "/commands/resetTrip.json";
    http.begin(firebaseClient, resetTripUrl);
    http.setReuse(true);
    http.setTimeout(800);

    httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        if (payload.indexOf("\"active\":true") >= 0 || payload.indexOf("\"active\": true") >= 0) {
            portENTER_CRITICAL(&dataMux);
            tripKm = 0.0;
            portEXIT_CRITICAL(&dataMux);
            Serial.println(F("[WEB] Trip Meter BERHASIL DIBERSIHKAN (0.0 KM)!"));

            // Clear active flag di Firebase
            HTTPClient clearHttp;
            clearHttp.begin(firebaseClient, resetTripUrl);
            clearHttp.addHeader("Content-Type", "application/json");
            clearHttp.PUT("{\"active\":false,\"timestamp\":0}");
            clearHttp.end();
        }
    }
    http.end();

    // 4. Sync Set/Calibrate ODO Command dari Web
    String setOdoUrl = String(FIREBASE_HOST) + "/commands/setOdo.json";
    http.begin(firebaseClient, setOdoUrl);
    http.setReuse(true);
    http.setTimeout(800);

    httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        if (payload.indexOf("\"active\":true") >= 0 || payload.indexOf("\"active\": true") >= 0) {
            int odoIdx = payload.indexOf("\"odo\":");
            if (odoIdx >= 0) {
                double newOdo = payload.substring(odoIdx + 6).toDouble();
                if (newOdo >= 1000.0 && newOdo <= 10000000.0) {
                    portENTER_CRITICAL(&dataMux);
                    odoKm = newOdo;
                    portEXIT_CRITICAL(&dataMux);
                    saveOdo();
                    Serial.printf("[WEB] ODO berhasil dikalibrasi ke: %.1f KM\n", odoKm);
                }
            }
            HTTPClient clearHttp;
            clearHttp.begin(firebaseClient, setOdoUrl);
            clearHttp.addHeader("Content-Type", "application/json");
            clearHttp.PUT("{\"active\":false,\"timestamp\":0}");
            clearHttp.end();
        }
    }
    http.end();
}

// ============================================================
// 12. FREERTOS BACKGROUND TELEMETRY TASK
// ============================================================
void telemetryTask(void *pvParameters) {
    unsigned long lastSend = 0;
    unsigned long lastSync = 0;

    for (;;) {
        // State Machine WiFi Non-blocking
        switch (wifiState) {
            case WIFI_IDLE:
                if (millis() - wifiRetry > 2000) {
                    Serial.println("\n[WIFI] Menghubungkan ke: " + String(ssid));
                    WiFi.disconnect(true);
                    vTaskDelay(pdMS_TO_TICKS(50));
                    WiFi.mode(WIFI_STA);
                    WiFi.setSleep(false);
                    WiFi.setAutoReconnect(true);
                    WiFi.persistent(true);
                    WiFi.setTxPower(WIFI_POWER_11dBm);
                    WiFi.begin(ssid, password);
                    wifiStart = millis();
                    dotTimer  = millis();
                    wifiState = WIFI_CONNECTING;
                }
                break;

            case WIFI_CONNECTING:
                if (WiFi.status() == WL_CONNECTED) {
                    Serial.println("\n[WIFI] TERHUBUNG CEPAT!");
                    Serial.print("[WIFI] IP Address: ");
                    Serial.println(WiFi.localIP());
                    wifiState = WIFI_CONNECTED;
                    startTimeSync();
                } else {
                    if (millis() - dotTimer > 500) {
                        Serial.print(".");
                        dotTimer = millis();
                    }
                    if (millis() - wifiStart > 10000) {
                        Serial.println("\n[WIFI] Timeout! Mencoba ulang...");
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
                } else {
                    unsigned long now = millis();
                    if (now - lastSend >= WEB_SEND_INTERVAL_MS) {
                        lastSend = now;
                        sendTelemetryToWeb();
                    }
                    if (now - lastSync >= WEB_SYNC_INTERVAL_MS) {
                        lastSync = now;
                        syncCommandsFromWeb();
                    }
                }
                break;
        }

        vTaskDelay(pdMS_TO_TICKS(50)); // Yield CPU ke Main Task
    }
}

// ============================================================
// 13. SETUP & MAIN LOOP
// ============================================================
void setup() {
    Serial.begin(115200);

    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(ORANGE_LED_PIN, OUTPUT);
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(ORANGE_LED_PIN, LOW);

    // Buffer UART GPS diperbesar menjadi 1KB agar kalimat NMEA tidak drop
    gpsSerial.setRxBufferSize(1024);
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

    // Kirim perintah konfigurasi UBX ke NEO-6M (Mode Otomotif 2Hz stabil)
    delay(100);
    configureGPS();

    // Inisialisasi I2C & Layar OLED SSD1306
    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        Serial.println(F("[OLED] Gagal menginisialisasi SSD1306! Cek wiring I2C."));
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.display();

    // Muat data Odometer dari Flash (otomatis reset ke 97,248 km jika data lama < 97248)
    loadOdo();

    firebaseClient.setInsecure();

    Serial.println(F("=================================================="));
    Serial.println(F("🚗 ESP32-C3 VEHICLE MONITOR & REALTIME OLED HUD READY"));
    Serial.printf(F("📍 ODOMETER TERKALIBRASI: %.1f KM\n"), odoKm);
    Serial.println(F("=================================================="));

    wifiRetry = millis() - 2000;
    wifiState = WIFI_IDLE;

    // Buat Task Background Telemetri FreeRTOS pada Priority 1
    xTaskCreate(
        telemetryTask,
        "TelemetryTask",
        8192,
        NULL,
        1,
        NULL
    );
}

void loop() {
    // 1. Baca NMEA GPS stream secara terus menerus (Zero-latency)
    readGPS();

    // 2. Filter kecepatan stabil anti-spike & evaluasi status fix
    updateSpeed();

    // 3. Kalkulasi Trip & Odometer dengan proteksi pergerakan diam
    updateTripAndOdo();

    // 4. Update jam & tanggal lokal (NTP / GPS fallback)
    updateDateTime();

    // 5. Evaluasi warning overspeed
    updateWarning();

    // 6. Refresh status indikator LED fisik (Pin 3 Hijau, Pin 4 Oren)
    updateLED();

    // 7. Render tampilan OLED SSD1306 HUD 10 FPS
    updateOLED();

    // Yield mikrodetik untuk kestabilan RTOS
    vTaskDelay(pdMS_TO_TICKS(10));
}
