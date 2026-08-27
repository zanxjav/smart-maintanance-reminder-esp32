#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>
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
// 2. PIN CONFIGURATION (ESP32-C3) - AMAN BEBAS STRAPPING PIN
// ============================================================
// GPS NEO-6M UART
#define GPS_RX_PIN     20   // ESP32-C3 RX <-- NEO-6M TX
#define GPS_TX_PIN     21   // ESP32-C3 TX --> NEO-6M RX
#define GPS_BAUD       9600

// TFT SPI (ST7789 240x240 IPS Display 7-Pin / 8-Pin)
// Hubungkan:
// SCL (SCLK) -> GPIO 4
// SDA (MOSI) -> GPIO 6
// RES (RST)  -> GPIO 1
// DC  (RS)   -> GPIO 2
// BLK (LED)  -> 3.3V (atau GPIO 5)
// CS         -> GND (jika ada pin CS)
#define TFT_SCLK_PIN   4    // SPI Clock (SCL di modul TFT)
#define TFT_MOSI_PIN   6    // SPI Data (SDA di modul TFT)
#define TFT_RST_PIN    1    // Reset (RES di modul TFT)
#define TFT_DC_PIN     2    // Data/Command (DC di modul TFT)
#define TFT_CS_PIN    -1    // -1 jika CS sudah di-ground internal modul
#define TFT_BLK_PIN    5    // Backlight control (atau jumper ke 3.3V)

#define SCREEN_WIDTH   240
#define SCREEN_HEIGHT  240

// LED Indikator Fisik
#define GREEN_LED_PIN  0    // LED Hijau (Status Normal / Standby)
#define ORANGE_LED_PIN 3    // LED Oren (Warning Speed / Flash Test Pin 4)

// ============================================================
// 3. PALET WARNA TFT 16-BIT (RGB565 AUTOMOTIVE THEME)
// ============================================================
#define COLOR_BG        0x0842  // Dark Navy / Black (#080C14)
#define COLOR_CARD_BG   0x10E4  // Card Dark Slate (#101B2B)
#define COLOR_BORDER    0x2988  // Border Gray/Blue
#define COLOR_CYAN      0x367F  // Electric Cyan (#38BDF8)
#define COLOR_GREEN     0x25F0  // Bright Emerald (#10B981)
#define COLOR_AMBER     0xFD00  // Warning Amber (#F59E0B)
#define COLOR_RED       0xF9A6  // Alert Crimson (#EF4444)
#define COLOR_WHITE     0xFFFF  // Pure White
#define COLOR_TEXT_MUTED 0x9514 // Muted Slate Text (#94A3B8)

// ============================================================
// 4. PARAMETER & TIMING NON-BLOCKING
// ============================================================
#define DEFAULT_SPEED_LIMIT      60.0
#define INITIAL_ODO_KM           97248.0
#define UTC_OFFSET_HOURS         7

#define TFT_UPDATE_INTERVAL_MS   100     // 10 FPS super smooth
#define LED_BLINK_INTERVAL_MS    175
#define WEB_SEND_INTERVAL_MS     1000    // Kirim telemetri tiap 1s
#define WEB_SYNC_INTERVAL_MS     3000    // Sinkronisasi limit tiap 3s

#define ODO_SAVE_DISTANCE_KM     0.5
#define ODO_SAVE_INTERVAL_MS     60000UL

// ============================================================
// 5. OBJEK GLOBAL & CLIENT
// ============================================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
Adafruit_ST7789 display = Adafruit_ST7789(&SPI, TFT_CS_PIN, TFT_DC_PIN, TFT_RST_PIN);
Preferences preferences;
WiFiClientSecure firebaseClient;

// ============================================================
// 6. STATE GLOBAL
// ============================================================
double speedLimit      = DEFAULT_SPEED_LIMIT;
double odoKm           = INITIAL_ODO_KM;
double tripKm          = 0.0;
double currentSpeed    = 0.0;
bool   gpsFix          = false;
bool   overSpeedActive = false;

// State tambahan khusus kendali Flash Test LED Oren
bool   flashTestActive = false;
unsigned long flashTestEndMs = 0;

double lastLat = 0.0;
double lastLng = 0.0;
bool   hasLastPosition = false;

int    consecutiveSpeedHits = 0;

double odoAtLastSave = INITIAL_ODO_KM;
unsigned long lastOdoSaveMs = 0;

unsigned long lastTftUpdateMs   = 0;
unsigned long lastBlinkMs       = 0;
unsigned long lastWebSendMs     = 0;
unsigned long lastWebSyncMs     = 0;
unsigned long lastValidSpeedMs  = 0;
unsigned long lastDistCalcMs    = 0;
bool blinkState = false;

int  wibDay = 1, wibMonth = 1, wibYear = 2026;
int  wibHour = 0, wibMinute = 0, wibSecond = 0;
bool dateTimeValid = false;
bool timeSyncStarted = false;

// State cache untuk render TFT anti-flicker (hanya redraw yang berubah)
int  lastDispSpeed = -999;
int  lastDispSat   = -999;
bool lastDispFix   = false;
bool lastDispWarn  = false;
bool lastDispFlash = false;
int  lastDispHour  = -1;
int  lastDispMin   = -1;
int  lastDispDay   = -1;
long lastDispOdo   = -1;
int  lastDispTrip10 = -1;

const char* MONTH_NAMES[] = {
  "JAN","FEB","MAR","APR","MEI","JUN",
  "JUL","AGU","SEP","OKT","NOV","DES"
};

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
    static const int table[] = {31,28,31,30,31,30,31,31,30,31,31,30,31};
    if (month == 2) {
        bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        return leap ? 29 : 28;
    }
    return table[month - 1];
}

void updateDateTime() {
    time_t now = time(nullptr);
    if (now > 1700000000) {
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
// 8. WIFI STATE MANAGEMENT (NON-BLOCKING)
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
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
    WiFi.setTxPower(WIFI_POWER_11dBm);

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
                startTimeSync();
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
// 9. TELEMETRI KE FIREBASE REALTIME DATABASE
// ============================================================
void sendTelemetryToWeb() {
    if (wifiState != WIFI_CONNECTED) return;

    unsigned long now = millis();
    if (now - lastWebSendMs < WEB_SEND_INTERVAL_MS) return;
    lastWebSendMs = now;

    HTTPClient http;
    String url = String(FIREBASE_HOST) + "/vehicle/current.json";
    
    http.begin(firebaseClient, url);
    http.setReuse(true);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(800);

    char timeStr[12], dateStr[16];
    if (dateTimeValid) {
        snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d", wibYear, wibMonth, wibDay);
        snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", wibHour, wibMinute, wibSecond);
    } else {
        snprintf(dateStr, sizeof(dateStr), "--");
        snprintf(timeStr, sizeof(timeStr), "--:--:--");
    }

    int sendSpeed = 0;
    double sendRawSpeed = 0.0;
    if (currentSpeed >= 2.8) {
        sendSpeed = (int)(currentSpeed + 0.5);
        sendRawSpeed = currentSpeed;
    }

    String json = "{";
    json += "\"speed\":" + String(sendSpeed) + ",";
    json += "\"rawSpeed\":" + String(sendRawSpeed, 1) + ",";
    json += "\"odo\":" + String((long)(odoKm + 0.5)) + ",";
    json += "\"trip\":" + String(tripKm, 2) + ",";
    json += "\"speedLimit\":" + String((int)speedLimit) + ",";
    json += "\"gps\":\"" + String(gpsFix ? "Connected" : "No Signal") + "\",";
    json += "\"esp32\":\"Online\",";
    json += "\"status\":\"" + String((overSpeedActive || flashTestActive) ? "Warning" : "Normal") + "\",";
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

    // 1. Sync Speed Limit
    HTTPClient http;
    String url = String(FIREBASE_HOST) + "/settings/speedLimit.json";
    
    http.begin(firebaseClient, url);
    http.setReuse(true);
    http.setTimeout(700);

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

    // 2. Sync Kendali Flash Test LED Oren
    String flashUrl = String(FIREBASE_HOST) + "/commands/flashTest.json";
    http.begin(firebaseClient, flashUrl);
    http.setReuse(true);
    http.setTimeout(700);

    httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        if (payload.indexOf("\"active\":true") >= 0 || payload.indexOf("\"active\": true") >= 0) {
            if (!flashTestActive) {
                flashTestActive = true;
                int duration = 5000;
                int durIdx = payload.indexOf("\"duration\":");
                if (durIdx >= 0) {
                    duration = payload.substring(durIdx + 11).toInt();
                    if (duration <= 0 || duration > 30000) duration = 5000;
                }
                flashTestEndMs = millis() + duration;
                Serial.printf("[WEB] Flash Test STARTED: %d ms (Pin %d LED)\n", duration, ORANGE_LED_PIN);
            }
        } else if (payload.indexOf("\"active\":false") >= 0 || payload.indexOf("\"active\": false") >= 0) {
            if (flashTestActive) {
                flashTestActive = false;
                Serial.println(F("[WEB] Flash Test STOPPED remotely"));
            }
        }
    }
    http.end();
}

// ============================================================
// 10. GPS, KECEPATAN & ODOMETER
// ============================================================
void readGPS() {
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }
}

void updateSpeed() {
    if (gps.speed.isValid() && gps.speed.age() < 2000 && gps.satellites.value() >= 4) {
        double rawKmph = gps.speed.kmph();

        if (rawKmph < 2.8) {
            consecutiveSpeedHits = 0;
            currentSpeed = 0.0;
        } else {
            consecutiveSpeedHits++;
            if (consecutiveSpeedHits >= 2 || currentSpeed > 0.0) {
                if (rawKmph >= 2.0) {
                    currentSpeed = rawKmph;
                } else {
                    currentSpeed = 0.0;
                    consecutiveSpeedHits = 0;
                }
            }
        }
        lastValidSpeedMs = millis();
        gpsFix = true;
    } else if (millis() - lastValidSpeedMs < 1500 && currentSpeed >= 3.5) {
        gpsFix = (gps.satellites.value() >= 4);
    } else {
        currentSpeed = 0.0;
        consecutiveSpeedHits = 0;
        gpsFix = (gps.satellites.value() >= 4) || (gps.location.isValid() && gps.location.age() < 3000);
    }
}

void updateTripAndOdo() {
    unsigned long now = millis();
    if (lastDistCalcMs == 0) {
        lastDistCalcMs = now;
        return;
    }
    double dtSec = (now - lastDistCalcMs) / 1000.0;
    lastDistCalcMs = now;

    if (currentSpeed < 2.8 || !gpsFix) {
        if (gps.location.isValid()) {
            lastLat = gps.location.lat();
            lastLng = gps.location.lng();
            hasLastPosition = true;
        }
        return;
    }

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
        if (distanceM >= 0.8 && distanceM <= 120.0) {
            double distanceKm = distanceM / 1000.0;
            tripKm += distanceKm;
            odoKm  += distanceKm;
            lastLat = curLat;
            lastLng = curLng;
            maybeSaveOdo();
            return;
        }
    }

    if (dtSec > 0.05 && dtSec < 1.5 && currentSpeed >= 3.0) {
        double deltaKm = (currentSpeed / 3600.0) * dtSec;
        tripKm += deltaKm;
        odoKm  += deltaKm;
        maybeSaveOdo();
    }
}

void loadOdo() {
    odoKm = preferences.getDouble("odoKm", INITIAL_ODO_KM);
    if (odoKm < 50000.0) {
        odoKm = INITIAL_ODO_KM;
        preferences.putDouble("odoKm", odoKm);
    }
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
    bool isWarning = overSpeedActive;

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
    digitalWrite(GREEN_LED_PIN, LOW);
    if (millis() - lastBlinkMs >= LED_BLINK_INTERVAL_MS) {
        lastBlinkMs = millis();
        blinkState = !blinkState;
        digitalWrite(ORANGE_LED_PIN, blinkState ? HIGH : LOW);
    }
}

// ============================================================
// 11. TFT ST7789 240x240 DASHBOARD (ZERO-FLICKER SCADA DESIGN)
// ============================================================
void drawDashboardLayout() {
    display.fillScreen(COLOR_BG);

    // 1. Header Bar (y: 0 - 32)
    display.fillRoundRect(6, 6, 228, 28, 6, COLOR_CARD_BG);
    display.drawRoundRect(6, 6, 228, 28, 6, COLOR_BORDER);

    // 2. Speedometer Center Gauge Card (y: 38 - 165)
    display.fillRoundRect(6, 38, 228, 126, 10, COLOR_CARD_BG);
    display.drawRoundRect(6, 38, 228, 126, 10, COLOR_BORDER);

    // Static label "KM/H"
    display.setTextSize(2);
    display.setTextColor(COLOR_TEXT_MUTED);
    display.setCursor(95, 125);
    display.print("KM/H");

    // 3. Bottom Cards (y: 168 - 234)
    // ODO Card (Left)
    display.fillRoundRect(6, 168, 111, 66, 8, COLOR_CARD_BG);
    display.drawRoundRect(6, 168, 111, 66, 8, COLOR_BORDER);
    display.setTextSize(1);
    display.setTextColor(COLOR_TEXT_MUTED);
    display.setCursor(14, 175);
    display.print("TOTAL ODO");

    // TRIP Card (Right)
    display.fillRoundRect(123, 168, 111, 66, 8, COLOR_CARD_BG);
    display.drawRoundRect(123, 168, 111, 66, 8, COLOR_BORDER);
    display.setTextSize(1);
    display.setTextColor(COLOR_TEXT_MUTED);
    display.setCursor(131, 175);
    display.print("TRIP METER");
}

void printCenteredNumber(int number, int y, int size, uint16_t color, uint16_t bg) {
    char buf[10];
    snprintf(buf, sizeof(buf), "%d", number);
    
    // Clear dynamic speed area cleanly without full redraw
    display.fillRect(15, y - 4, 210, 68, bg);
    
    display.setTextSize(size);
    display.setTextColor(color, bg);
    int16_t x1, y1; uint16_t w, h;
    display.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);
    int x = (SCREEN_WIDTH - (int)w) / 2;
    if (x < 15) x = 15;
    display.setCursor(x, y);
    display.print(buf);
}

void updateTFT() {
    unsigned long now = millis();
    if (now - lastTftUpdateMs < TFT_UPDATE_INTERVAL_MS) return;
    lastTftUpdateMs = now;

    // --- 1. UPDATE HEADER: TANGGAL, STATUS CLOUD, JAM ---
    if (wibDay != lastDispDay || wibHour != lastDispHour || wibMinute != lastDispMin) {
        lastDispDay  = wibDay;
        lastDispHour = wibHour;
        lastDispMin  = wibMinute;

        // Tanggal
        display.fillRect(12, 12, 60, 16, COLOR_CARD_BG);
        display.setTextSize(1);
        display.setTextColor(COLOR_CYAN, COLOR_CARD_BG);
        display.setCursor(12, 15);
        if (dateTimeValid) {
            char dStr[10];
            snprintf(dStr, sizeof(dStr), "%02d %s", wibDay, MONTH_NAMES[wibMonth - 1]);
            display.print(dStr);
        } else {
            display.print("-- ---");
        }

        // Jam Menit
        display.fillRect(174, 12, 54, 16, COLOR_CARD_BG);
        display.setTextSize(1);
        display.setTextColor(COLOR_WHITE, COLOR_CARD_BG);
        display.setCursor(176, 15);
        if (dateTimeValid) {
            char tStr[8];
            snprintf(tStr, sizeof(tStr), "%02d:%02d", wibHour, wibMinute);
            display.print(tStr);
        } else {
            display.print("--:--");
        }
    }

    // Status WiFi / Flash Test Badge di tengah Header
    if (flashTestActive != lastDispFlash || (wifiState == WIFI_CONNECTED) != lastDispFix) {
        lastDispFlash = flashTestActive;
        lastDispFix = (wifiState == WIFI_CONNECTED);

        display.fillRect(80, 10, 80, 20, COLOR_CARD_BG);
        display.setTextSize(1);
        if (flashTestActive) {
            display.fillRoundRect(82, 11, 76, 18, 4, COLOR_AMBER);
            display.setTextColor(COLOR_BG, COLOR_AMBER);
            display.setCursor(88, 16);
            display.print("FLASH TEST");
        } else if (wifiState == WIFI_CONNECTED) {
            display.fillRoundRect(88, 11, 64, 18, 4, COLOR_GREEN);
            display.setTextColor(COLOR_BG, COLOR_GREEN);
            display.setCursor(96, 16);
            display.print("LIVE IOT");
        } else {
            display.setTextColor(COLOR_TEXT_MUTED, COLOR_CARD_BG);
            display.setCursor(90, 16);
            display.print("OFFLINE");
        }
    }

    // --- 2. UPDATE SPEED DISPLAY (CENTER GAUGE) ---
    int displaySpeed = 0;
    if (gpsFix && currentSpeed >= 2.8) {
        displaySpeed = (int)(currentSpeed + 0.5);
    }

    bool isWarning = overSpeedActive || flashTestActive;

    if (displaySpeed != lastDispSpeed || isWarning != lastDispWarn) {
        lastDispSpeed = displaySpeed;
        lastDispWarn  = isWarning;

        uint16_t speedColor = COLOR_CYAN;
        if (isWarning) {
            speedColor = COLOR_RED;
        } else if (displaySpeed >= (int)(speedLimit * 0.85)) {
            speedColor = COLOR_AMBER;
        }

        if (gpsFix) {
            printCenteredNumber(displaySpeed, 54, 7, speedColor, COLOR_CARD_BG);
        } else {
            display.fillRect(15, 50, 210, 68, COLOR_CARD_BG);
            display.setTextSize(4);
            display.setTextColor(COLOR_AMBER, COLOR_CARD_BG);
            display.setCursor(55, 66);
            display.print("NO GPS");
        }

        // Status Limit / Warning Banner di bawah Speed
        display.fillRect(12, 146, 216, 15, COLOR_CARD_BG);
        display.setTextSize(1);
        if (isWarning) {
            display.setTextColor(COLOR_RED, COLOR_CARD_BG);
            display.setCursor(52, 148);
            display.print(flashTestActive ? "! FLASH TEST ACTIVE !" : "! OVER SPEED LIMIT !");
        } else {
            display.setTextColor(COLOR_TEXT_MUTED, COLOR_CARD_BG);
            display.setCursor(58, 148);
            char limStr[28];
            snprintf(limStr, sizeof(limStr), "SPEED LIMIT: %d KM/H", (int)speedLimit);
            display.print(limStr);
        }
    }

    // --- 3. UPDATE ODO & TRIP (BOTTOM CARDS) ---
    long curOdoInt = (long)(odoKm + 0.5);
    if (curOdoInt != lastDispOdo) {
        lastDispOdo = curOdoInt;
        display.fillRect(12, 192, 98, 36, COLOR_CARD_BG);
        display.setTextSize(2);
        display.setTextColor(COLOR_WHITE, COLOR_CARD_BG);
        display.setCursor(14, 194);
        display.print(curOdoInt);
        display.setTextSize(1);
        display.setTextColor(COLOR_CYAN, COLOR_CARD_BG);
        display.setCursor(14, 216);
        display.print("KM TOTAL");
    }

    int curTrip10 = (int)(tripKm * 10.0 + 0.5);
    if (curTrip10 != lastDispTrip10) {
        lastDispTrip10 = curTrip10;
        display.fillRect(129, 192, 98, 36, COLOR_CARD_BG);
        display.setTextSize(2);
        display.setTextColor(COLOR_WHITE, COLOR_CARD_BG);
        display.setCursor(131, 194);
        display.print(tripKm, 1);
        display.setTextSize(1);
        display.setTextColor(COLOR_GREEN, COLOR_CARD_BG);
        display.setCursor(131, 216);
        display.print("KM TRIP");
    }
}

// ============================================================
// 12. SETUP & MAIN LOOP
// ============================================================
void setup() {
    Serial.begin(115200);

    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(ORANGE_LED_PIN, OUTPUT);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(ORANGE_LED_PIN, LOW);

    // 1. Inisialisasi Backlight TFT (Pin BLK)
    pinMode(TFT_BLK_PIN, OUTPUT);
    digitalWrite(TFT_BLK_PIN, HIGH);

    // 2. Inisialisasi Bus Hardware SPI ESP32-C3 (SCLK, MISO, MOSI, SS)
    SPI.begin(TFT_SCLK_PIN, -1, TFT_MOSI_PIN, -1);

    // 3. Inisialisasi ST7789 TFT 240x240
    // SPI_MODE2 adalah mode standar paling kompatibel untuk modul ST7789 7-pin tanpa CS
    display.init(SCREEN_WIDTH, SCREEN_HEIGHT, SPI_MODE2);
    display.setRotation(0);          // Rotasi 0-3 (0: Normal vertikal)
    display.invertDisplay(true);     // ST7789 IPS butuh invert true agar warna tidak terbalik
    display.fillScreen(COLOR_BG);

    // Render layout dashboard awal
    drawDashboardLayout();

    // 4. Inisialisasi UART GPS NEO-6M
    gpsSerial.setRxBufferSize(1024);
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

    // 5. Load Odometer dari Flash NVRAM
    preferences.begin("speedo", false);
    loadOdo();

    // 6. Security Client TLS Firebase
    firebaseClient.setInsecure();

    Serial.println(F("====================================================="));
    Serial.println(F(" VEHICLE MONITOR - TFT ST7789 240x240 READY! "));
    Serial.println(F("====================================================="));

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
    updateTFT();

    sendTelemetryToWeb();
    syncSpeedLimitFromWeb();

    yield();
}
