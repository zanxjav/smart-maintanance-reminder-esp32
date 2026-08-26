#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Firebase Helper Addons
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ============================================================
// KONFIGURASI WIFI & FIREBASE REALTIME DATABASE
// ============================================================
#define WIFI_SSID       "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD   "PASSWORD_WIFI_ANDA"

#define API_KEY         "AIzaSyD-YOUR_FIREBASE_WEB_API_KEY"
#define DATABASE_URL    "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/" // Pastikan diakhiri '/'

// ============================================================
// PIN CONFIGURATION (ESP32-C3)
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
// KONFIGURASI UTAMA & DEFAULT
// ============================================================
#define DEFAULT_SPEED_LIMIT 60.0    // Nilai default awal jika belum diset dari web
#define INITIAL_ODO_KM      97000.0 // Odometer awal (jika belum ada di Flash)
#define MIN_MOVE_METERS     2.0     // Filter jitter GPS saat diam
#define UTC_OFFSET_HOURS    7       // WIB = UTC+7

// ============================================================
// KONFIGURASI TIMING (Semua Non-Blocking millis())
// ============================================================
#define OLED_UPDATE_INTERVAL_MS      150
#define LED_BLINK_INTERVAL_MS        300
#define DEBUG_PRINT_INTERVAL_MS      1000
#define FIREBASE_SEND_INTERVAL_MS    1000   // Kirim telemetri ke web tiap 1 detik
#define FIREBASE_SYNC_LIMIT_MS       2000   // Cek update speed limit dari web tiap 2 detik

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

// Objek Firebase
FirebaseData fbdoData;
FirebaseData fbdoStream;
FirebaseAuth auth;
FirebaseConfig config;
bool isFirebaseReady = false;

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

unsigned long lastOledUpdateMs   = 0;
unsigned long lastBlinkMs        = 0;
unsigned long lastFirebaseSendMs = 0;
unsigned long lastLimitSyncMs    = 0;
bool blinkState = false;

int  wibDay, wibMonth, wibYear;
int  wibHour, wibMinute, wibSecond;
bool dateTimeValid = false;

const char* MONTH_NAMES[] = {
  "JAN","FEB","MAR","APR","MEI","JUN",
  "JUL","AGU","SEP","OKT","NOV","DES"
};

// ============================================================
// DEKLARASI FUNGSI
// ============================================================
void initWiFi();
void initFirebase();
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
void syncSpeedLimitFromFirebase();
void sendTelemetryToFirebase();
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
    Serial.println(F("OLED tidak terdeteksi!"));
    while (true) {
      digitalWrite(GREEN_LED_PIN, HIGH);
      digitalWrite(ORANGE_LED_PIN, HIGH);
      delay(400);
      digitalWrite(GREEN_LED_PIN, LOW);
      digitalWrite(ORANGE_LED_PIN, LOW);
      delay(400);
    }
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(10, 20);
  display.println(F("Connecting WiFi..."));
  display.display();

  preferences.begin("speedo", false);
  loadOdo();

  // Inisialisasi Koneksi WiFi & Firebase
  initWiFi();
  initFirebase();

  Serial.println(F("=== Digital Vehicle Speedometer & IoT SCADA ==="));
  Serial.print(F("ODO Awal: "));
  Serial.print(odoKm, 2);
  Serial.println(F(" km"));
}

// ============================================================
// LOOP NON-BLOCKING
// ============================================================
void loop() {
  readGPS();
  updateSpeed();
  updateTripAndOdo();
  updateDateTime();
  updateWarning();
  updateLED();
  updateOLED();

  // Sinkronisasi Data Web & IoT
  if (Firebase.ready() && isFirebaseReady) {
    syncSpeedLimitFromFirebase();
    sendTelemetryToFirebase();
  }

  debugPrint();
}

// ============================================================
// INISIALISASI WIFI & FIREBASE
// ============================================================
void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("Menghubungkan ke WiFi "));
  
  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
    delay(300);
    Serial.print(F("."));
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[WiFi] Terhubung! IP: "));
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(F("\n[WiFi] Gagal terhubung. Menjalankan mode offline sementara."));
  }
}

void initFirebase() {
  if (WiFi.status() != WL_CONNECTED) return;

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Anonymous Sign In
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println(F("[Firebase] SignUp Anonymous Berhasil!"));
    isFirebaseReady = true;
  } else {
    Serial.printf("[Firebase] SignUp Gagal: %s\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Set buffer size
  fbdoData.setBSSLBufferSize(1024, 1024);
  fbdoData.setResponseSize(1024);
}

// ============================================================
// SINKRONISASI FIREBASE (SPEED LIMIT & TELEMETRI)
// ============================================================
void syncSpeedLimitFromFirebase() {
  unsigned long now = millis();
  if (now - lastLimitSyncMs < FIREBASE_SYNC_LIMIT_MS) return;
  lastLimitSyncMs = now;

  // Baca Speed Limit yang diubah user dari Web Dashboard
  if (Firebase.RTDB.getInt(&fbdoData, "/settings/speedLimit")) {
    if (fbdoData.dataType() == "int" || fbdoData.dataType() == "float") {
      int newLimit = fbdoData.intData();
      if (newLimit >= 20 && newLimit <= 180 && newLimit != (int)speedLimit) {
        speedLimit = (double)newLimit;
        Serial.printf("[IoT] Speed Limit Diperbarui dari Web: %.0f KM/H\n", speedLimit);
      }
    }
  }
}

void sendTelemetryToFirebase() {
  unsigned long now = millis();
  if (now - lastFirebaseSendMs < FIREBASE_SEND_INTERVAL_MS) return;
  lastFirebaseSendMs = now;

  // Bentuk payload JSON yang sesuai persis dengan ekspektasi Web Dashboard
  FirebaseJson json;
  json.set("speed", (int)(currentSpeed + 0.5));
  json.set("rawSpeed", currentSpeed);
  json.set("odo", (long)odoKm);
  json.set("trip", tripKm);
  json.set("speedLimit", (int)speedLimit);
  json.set("gps", gpsFix ? "Connected" : "No Signal");
  json.set("esp32", "Online");
  json.set("status", overSpeedActive ? "Warning" : "Normal");

  if (dateTimeValid) {
    char dateStr[14];
    char timeStr[10];
    snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d", wibYear, wibMonth, wibDay);
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", wibHour, wibMinute, wibSecond);
    json.set("date", dateStr);
    json.set("time", timeStr);
    json.set("lastUpdate", timeStr);
  } else {
    json.set("date", "--");
    json.set("time", "--");
    json.set("lastUpdate", "--");
  }

  json.set("lat", gps.location.lat());
  json.set("lng", gps.location.lng());
  json.set("satellites", gps.satellites.value());

  // Kirim data ke node /vehicle/current (Metode Update/Set non-blocking)
  if (Firebase.RTDB.updateNode(&fbdoData, "/vehicle/current", &json)) {
    // Berhasil kirim
  } else {
    Serial.printf("[Firebase Error] %s\n", fbdoData.errorReason().c_str());
  }
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
// DEBUG SERIAL MONITOR
// ============================================================
void debugPrint() {
#if DEBUG_SERIAL
  static unsigned long lastDebugMs = 0;
  unsigned long now = millis();
  if (now - lastDebugMs < DEBUG_PRINT_INTERVAL_MS) return;
  lastDebugMs = now;

  Serial.print(F("WiFi:"));    Serial.print(WiFi.status() == WL_CONNECTED ? F("OK") : F("DISCONNECTED"));
  Serial.print(F(" | Sat:"));  Serial.print(gps.satellites.value());
  Serial.print(F(" | Fix:"));  Serial.print(gpsFix ? F("YES") : F("NO"));
  Serial.print(F(" | Spd:"));  Serial.print(currentSpeed, 1);
  Serial.print(F(" | Lim:"));  Serial.print(speedLimit, 0);
  Serial.print(F(" | ODO:"));  Serial.print(odoKm, 2);
  Serial.print(F(" | TRIP:")); Serial.println(tripKm, 2);
#endif
}
