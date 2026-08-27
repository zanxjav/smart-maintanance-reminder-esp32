/*
 * ============================================================
 * ST7789 240x240 7-PIN DIAGNOSTIC & COLOR TEST
 * ESP32-C3 / ESP32 Standalone TFT Hardware Test
 * ============================================================
 * WIRING (7-Pin Module -> ESP32-C3):
 * 1. GND -> GND
 * 2. VCC -> 3.3V (atau 5V jika modul ada regulator 3.3V)
 * 3. SCL -> GPIO 4 (SCLK)
 * 4. SDA -> GPIO 6 (MOSI)
 * 5. RES -> GPIO 7 (RST)
 * 6. DC  -> GPIO 10 (DC)
 * 7. BLK -> 3.3V Langsung atau GPIO 5 (Backlight)
 * ============================================================
 */

#include <Arduino.h>
#include "ST7789_ESP32.h"

#define TFT_SCLK_PIN   4
#define TFT_MOSI_PIN   6
#define TFT_RST_PIN    7
#define TFT_DC_PIN     10
#define TFT_BLK_PIN    5   // Backlight (atau hubungkan ke 3.3V)

// Inisialisasi driver display ST7789 ESP32
ST7789_ESP32 tft(TFT_SCLK_PIN, TFT_MOSI_PIN, TFT_DC_PIN, TFT_RST_PIN, -1, TFT_BLK_PIN);

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println(F("\n=============================================="));
    Serial.println(F("   ST7789 240x240 7-PIN HARDWARE TEST"));
    Serial.println(F("=============================================="));

    // Pastikan backlight ON
    pinMode(TFT_BLK_PIN, OUTPUT);
    digitalWrite(TFT_BLK_PIN, HIGH);
    Serial.println(F("[1] Backlight turned ON"));

    // Inisialisasi layar (Hardware SPI 40MHz)
    Serial.println(F("[2] Initializing ST7789 Display..."));
    tft.begin(240, 240, true, 40000000);
    tft.setRotation(0);
    tft.invertDisplay(true); // Panel ST7789 IPS butuh Invert ON
    Serial.println(F("[3] Display begin OK!"));

    // TEST 1: Splash Colors
    Serial.println(F("[4] Testing Color Screens..."));
    
    tft.fillScreen(COLOR_RED);
    Serial.println(F("    -> RED Screen"));
    delay(700);

    tft.fillScreen(COLOR_GREEN);
    Serial.println(F("    -> GREEN Screen"));
    delay(700);

    tft.fillScreen(COLOR_BLUE);
    Serial.println(F("    -> BLUE Screen"));
    delay(700);

    tft.fillScreen(COLOR_WHITE);
    Serial.println(F("    -> WHITE Screen"));
    delay(700);

    tft.fillScreen(COLOR_BLACK);
    Serial.println(F("    -> BLACK Screen"));
    delay(400);

    // TEST 2: Draw Shapes and Text
    Serial.println(F("[5] Drawing Demo Dashboard..."));
    tft.fillScreen(0x0842); // Dark Navy

    // Header Card
    tft.fillRoundRect(8, 8, 224, 30, 6, 0x10E4);
    tft.drawRoundRect(8, 8, 224, 30, 6, 0x2988);
    tft.setTextSize(1);
    tft.setTextColor(COLOR_CYAN, 0x10E4);
    tft.setCursor(16, 18);
    tft.print("ST7789 ESP32 TEST");

    tft.fillRoundRect(160, 14, 64, 18, 4, COLOR_GREEN);
    tft.setTextColor(0x0842, COLOR_GREEN);
    tft.setCursor(170, 19);
    tft.print("ONLINE");

    // Center Card (Speedometer)
    tft.fillRoundRect(8, 44, 224, 116, 8, 0x10E4);
    tft.drawRoundRect(8, 44, 224, 116, 8, 0x2988);

    tft.setTextSize(6);
    tft.setTextColor(COLOR_WHITE, 0x10E4);
    tft.setCursor(85, 62);
    tft.print("88");

    tft.setTextSize(2);
    tft.setTextColor(0x9514, 0x10E4);
    tft.setCursor(95, 126);
    tft.print("KM/H");

    // Bottom Cards
    tft.fillRoundRect(8, 166, 108, 64, 6, 0x10E4);
    tft.drawRoundRect(8, 166, 108, 64, 6, 0x2988);
    tft.setTextSize(1);
    tft.setTextColor(0x9514, 0x10E4);
    tft.setCursor(16, 174);
    tft.print("TOTAL ODO");
    tft.setTextSize(2);
    tft.setTextColor(COLOR_CYAN, 0x10E4);
    tft.setCursor(16, 194);
    tft.print("97248");

    tft.fillRoundRect(124, 166, 108, 64, 6, 0x10E4);
    tft.drawRoundRect(124, 166, 108, 64, 6, 0x2988);
    tft.setTextSize(1);
    tft.setTextColor(0x9514, 0x10E4);
    tft.setCursor(132, 174);
    tft.print("TRIP METER");
    tft.setTextSize(2);
    tft.setTextColor(COLOR_GREEN, 0x10E4);
    tft.setCursor(132, 194);
    tft.print("14.8");

    Serial.println(F("[6] Test Completed Successfully! Ready for loop."));
}

int demoSpeed = 0;
int direction = 1;

void loop() {
    // Dynamic counter test
    demoSpeed += direction * 2;
    if (demoSpeed >= 120) direction = -1;
    if (demoSpeed <= 0) direction = 1;

    char buf[8];
    snprintf(buf, sizeof(buf), "%3d", demoSpeed);

    tft.setTextSize(6);
    if (demoSpeed > 80) {
        tft.setTextColor(COLOR_RED, 0x10E4);
    } else {
        tft.setTextColor(COLOR_WHITE, 0x10E4);
    }
    tft.setCursor(70, 62);
    tft.print(buf);

    delay(80);
}
