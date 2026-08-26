#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// ============================================================
// KONFIGURASI WIFI LANGSUNG (DIRECT FAST WIFI)
// ============================================================
const char* WIFI_SSID     = "GALAXY A33 5G";
const char* WIFI_PASSWORD = "cicing77";

// ============================================================
// PIN CONFIGURATION (ESP32-C3 / ESP32 Standar)
// ============================================================
#define GPS_RX_PIN      20   // ESP32-C3 RX <-- NEO-6M TX
#define GPS_TX_PIN      21   // ESP32-C3 TX --> NEO-6M RX
#define GPS_BAUD        9600

#define OLED_SDA_PIN    5
#define OLED_SCL_PIN    6
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_ADDR       0x3C

#define GREEN_LED_PIN   3
#define ORANGE_LED_PIN  4

// ============================================================
// KONFIGURASI DEFAULT & TIMING
// ============================================================
#define DEFAULT_SPEED_LIMIT 60.0
#define INITIAL_ODO_KM      97000.0
#define MIN_MOVE_METERS     2.0
#define UTC_OFFSET_HOURS    7

#define OLED_UPDATE_INTERVAL_MS      150
#define LED_BLINK_INTERVAL_MS        300
#define DEBUG_PRINT_INTERVAL_MS      1000

#define ODO_SAVE_DISTANCE_KM         0.5
#define ODO_SAVE_INTERVAL_MS         60000UL

#define DEBUG_SERIAL 1

// ============================================================
// OBJEK GLOBAL
// ============================================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Preferences preferences;
WebServer server(80);

// ============================================================
// STATE GLOBAL
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
bool blinkState = false;

int  wibDay, wibMonth, wibYear;
int  wibHour, wibMinute, wibSecond;
bool dateTimeValid = false;

String espIP = "0.0.0.0";

const char* MONTH_NAMES[] = {
  "JAN","FEB","MAR","APR","MEI","JUN",
  "JUL","AGU","SEP","OKT","NOV","DES"
};

// ============================================================
// PROTOTYPE FUNGSI
// ============================================================
void initWiFi();
void setupWebServer();
void readGPS();
void updateSpeed();
void updateTripAndOdo();
void updateDateTime();
void updateWarning();
void updateLED();
void updateOLED();
void drawNormalDisplay();
void drawWarningDisplay();
void drawDateTimeRow();
void drawSpeedNumber(bool blinking);
void drawBottomLabel();
void drawOdoTripRow();
void drawWarningIcon(int x, int y, int size);
void printCentered(const char* text, int y, int textSize);
int  daysInMonth(int month, int year);
void saveOdo();
void loadOdo();
void maybeSaveOdo();
void resetTrip();
void debugPrint();

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);

  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(ORANGE_LED_PIN, OUTPUT);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(ORANGE_LED_PIN, LOW);

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("OLED Gagal Inisialisasi!"));
    while (true) {
      digitalWrite(GREEN_LED_PIN, HIGH);
      digitalWrite(ORANGE_LED_PIN, HIGH);
      delay(300);
      digitalWrite(GREEN_LED_PIN, LOW);
      digitalWrite(ORANGE_LED_PIN, LOW);
      delay(300);
    }
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 15);
  display.println(F("Vehicle Monitor"));
  display.setCursor(0, 30);
  display.println(F("Connecting WiFi..."));
  display.display();

  preferences.begin("speedo", false);
  loadOdo();

  // Koneksi WiFi Berkecepatan Tinggi
  initWiFi();

  // Inisialisasi WebServer & mDNS
  setupWebServer();

  Serial.println(F("\n=== ESP32 Direct Vehicle Monitor Ready ==="));
  Serial.printf("Akses Web Dashboard di browser: http://%s atau http://vehicle.local\n", espIP.c_str());
}

// ============================================================
// LOOP NON-BLOCKING
// ============================================================
void loop() {
  server.handleClient(); // Handle request dari Web Dashboard secara instan
  readGPS();
  updateSpeed();
  updateTripAndOdo();
  updateDateTime();
  updateWarning();
  updateLED();
  updateOLED();
  debugPrint();
}

// ============================================================
// INISIALISASI WIFI & WEB SERVER (ULTRA LOW LATENCY)
// ============================================================
void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Nonaktifkan power saving WiFi untuk latensi terendah
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  Serial.print(F("Menghubungkan ke "));
  Serial.print(WIFI_SSID);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < 10000) {
    delay(200);
    Serial.print(F("."));
  }

  display.clearDisplay();
  display.setCursor(0, 10);

  if (WiFi.status() == WL_CONNECTED) {
    espIP = WiFi.localIP().toString();
    Serial.println(F("\n[WiFi] Terhubung!"));
    Serial.print(F("[WiFi] IP Address: "));
    Serial.println(espIP);

    if (MDNS.begin("vehicle")) {
      Serial.println(F("[mDNS] Responder aktif: http://vehicle.local"));
    }

    display.println(F("WiFi Connected!"));
    display.setCursor(0, 25);
    display.print(F("IP: "));
    display.println(espIP);
    display.setCursor(0, 40);
    display.println(F("http://vehicle.local"));
    display.display();
    delay(1500);
  } else {
    Serial.println(F("\n[WiFi] Gagal terhubung, mode offline aktif."));
    display.println(F("WiFi Disconnected"));
    display.setCursor(0, 25);
    display.println(F("Running Standalone"));
    display.display();
    delay(1000);
  }
}

// ============================================================
// REST API ENDPOINTS UNTUK WEB DASHBOARD
// ============================================================
void setupWebServer() {
  // 1. Endpoint Realtime Telemetry JSON (GET /api/telemetry)
  server.on("/api/telemetry", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Headers", "*");
    server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    char dateStr[14] = "--";
    char timeStr[10] = "--";
    if (dateTimeValid) {
      snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d", wibYear, wibMonth, wibDay);
      snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", wibHour, wibMinute, wibSecond);
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
    json += "\"satellites\":" + String(gps.satellites.value()) + ",";
    json += "\"ip\":\"" + espIP + "\"";
    json += "}";

    server.send(200, "application/json", json);
  });

  // 2. Endpoint Ubah Speed Limit Langsung dari Web (GET /api/speedlimit?val=80)
  server.on("/api/speedlimit", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Headers", "*");

    if (server.hasArg("val")) {
      int newLimit = server.arg("val").toInt();
      if (newLimit >= 20 && newLimit <= 180) {
        speedLimit = (double)newLimit;
        Serial.printf("[REST API] Speed Limit Diubah ke: %.0f KM/H\n", speedLimit);
        server.send(200, "application/json", "{\"success\":true,\"speedLimit\":" + String((int)speedLimit) + "}");
        return;
      }
    }
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Nilai limit tidak valid\"}");
  });

  // 3. Endpoint Reset Trip Meter Langsung dari Web (GET /api/resettrip)
  server.on("/api/resettrip", HTTP_ANY, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Headers", "*");
    resetTrip();
    Serial.println(F("[REST API] Trip Meter Direset!"));
    server.send(200, "application/json", "{\"success\":true,\"trip\":0.0}");
  });

  // 4. CORS Options Preflight Handler
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "*");
      server.send(204);
    } else {
      server.send(404, "text/plain", "Not found");
    }
  });

  server.begin();
  Serial.println(F("[HTTP] WebServer aktif di port 80"));
}

// ============================================================
// GPS
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

// ============================================================
// TRIP & ODO
// ============================================================
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

void resetTrip() {
  tripKm = 0.0;
}

// ============================================================
// PENYIMPANAN ODO (Preferences/NVS)
// ============================================================
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
  bool jarakCukup = (odoKm - odoAtLastSave) >= ODO_SAVE_DISTANCE_KM;
  bool waktuCukup = (millis() - lastOdoSaveMs) >= ODO_SAVE_INTERVAL_MS;

  if (jarakCukup || waktuCukup) {
    saveOdo();
  }
}

// ============================================================
// TANGGAL & WAKTU (GPS UTC -> WIB)
// ============================================================
void updateDateTime() {
  if (!gps.time.isValid() || !gps.date.isValid()) return;

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

int daysInMonth(int month, int year) {
  static const int table[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  if (month == 2) {
    bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    return leap ? 29 : 28;
  }
  return table[month - 1];
}

// ============================================================
// WARNING & ALARM
// ============================================================
void updateWarning() {
  overSpeedActive = gpsFix && (currentSpeed > speedLimit);
}

// ============================================================
// LED
// ============================================================
void updateLED() {
  if (!overSpeedActive) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(ORANGE_LED_PIN, LOW);
    return;
  }

  digitalWrite(GREEN_LED_PIN, LOW);

  unsigned long now = millis();
  if (now - lastBlinkMs >= LED_BLINK_INTERVAL_MS) {
    lastBlinkMs = now;
    blinkState = !blinkState;
    digitalWrite(ORANGE_LED_PIN, blinkState ? HIGH : LOW);
  }
}

// ============================================================
// OLED
// ============================================================
void updateOLED() {
  unsigned long now = millis();
  if (now - lastOledUpdateMs < OLED_UPDATE_INTERVAL_MS) return;
  lastOledUpdateMs = now;

  display.clearDisplay();

  if (overSpeedActive) {
    drawWarningDisplay();
  } else {
    drawNormalDisplay();
  }

  display.display();
}

void drawNormalDisplay() {
  drawDateTimeRow();
  drawSpeedNumber(false);
  drawBottomLabel();
  drawOdoTripRow();
}

void drawWarningDisplay() {
  drawDateTimeRow();
  drawSpeedNumber(true);
  drawBottomLabel();
  drawOdoTripRow();
  drawWarningIcon(4, 16, 20);
}

void drawDateTimeRow() {
  display.setTextSize(1);

  char dateStr[14];
  char timeStr[10];

  if (dateTimeValid) {
    snprintf(dateStr, sizeof(dateStr), "%d %s %d", wibDay, MONTH_NAMES[wibMonth - 1], wibYear);
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", wibHour, wibMinute, wibSecond);
  } else {
    snprintf(dateStr, sizeof(dateStr), "-- --- ----");
    snprintf(timeStr, sizeof(timeStr), "--:--:--");
  }

  display.setCursor(0, 0);
  display.print(dateStr);

  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(timeStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor(SCREEN_WIDTH - w, 0);
  display.print(timeStr);
}

void drawSpeedNumber(bool blinking) {
  if (blinking && !blinkState) return;

  char speedStr[5];
  if (gpsFix) {
    snprintf(speedStr, sizeof(speedStr), "%d", (int)(currentSpeed + 0.5));
  } else {
    snprintf(speedStr, sizeof(speedStr), "--");
  }

  printCentered(speedStr, 16, 4);
}

void drawBottomLabel() {
  if (gpsFix) {
    printCentered("KM/H", 47, 1);
  } else {
    printCentered("NO GPS", 47, 1);
  }
}

void drawOdoTripRow() {
  display.setTextSize(1);

  char odoStr[20];
  char tripStr[20];
  snprintf(odoStr, sizeof(odoStr), "ODO %ld km", (long)odoKm);
  snprintf(tripStr, sizeof(tripStr), "TRIP %.2f", tripKm);

  display.setCursor(0, 56);
  display.print(odoStr);

  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(tripStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor(SCREEN_WIDTH - w, 56);
  display.print(tripStr);
}

void drawWarningIcon(int x, int y, int size) {
  int x0 = x,            y0 = y + size;
  int x1 = x + size / 2, y1 = y;
  int x2 = x + size,     y2 = y + size;
  display.drawTriangle(x0, y0, x1, y1, x2, y2, SSD1306_WHITE);

  int barW = 2, barH = size / 2;
  display.fillRect(x + size / 2 - barW / 2, y + size / 4, barW, barH, SSD1306_WHITE);
  display.fillRect(x + size / 2 - 1, y + size - size / 6, 2, 2, SSD1306_WHITE);
}

void printCentered(const char* text, int y, int textSize) {
  display.setTextSize(textSize);
  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  int x = (SCREEN_WIDTH - (int)w) / 2;
  if (x < 0) x = 0;
  display.setCursor(x, y);
  display.print(text);
}

// ============================================================
// DEBUG SERIAL
// ============================================================
void debugPrint() {
#if DEBUG_SERIAL
  static unsigned long lastDebugMs = 0;
  unsigned long now = millis();
  if (now - lastDebugMs < DEBUG_PRINT_INTERVAL_MS) return;
  lastDebugMs = now;

  Serial.print(F("WiFi:"));    Serial.print(WiFi.status() == WL_CONNECTED ? espIP : F("OFFLINE"));
  Serial.print(F(" | Sat:"));  Serial.print(gps.satellites.value());
  Serial.print(F(" | Fix:"));  Serial.print(gpsFix ? F("YES") : F("NO"));
  Serial.print(F(" | Spd:"));  Serial.print(currentSpeed, 1);
  Serial.print(F(" | Lim:"));  Serial.print(speedLimit, 0);
  Serial.print(F(" | ODO:"));  Serial.print(odoKm, 2);
  Serial.print(F(" | TRIP:")); Serial.println(tripKm, 2);
#endif
}
