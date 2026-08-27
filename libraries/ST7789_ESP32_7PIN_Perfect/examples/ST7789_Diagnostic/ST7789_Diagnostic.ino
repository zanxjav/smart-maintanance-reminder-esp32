#include <ST7789_ESP32.h>

// ESP32-C3 SuperMini -> ST7789 240x240 7-pin
#define TFT_SCLK 4
#define TFT_MOSI 6
#define TFT_DC   10
#define TFT_RST  7
#define TFT_BLK  5

ST7789_ESP32 tft(TFT_SCLK, TFT_MOSI, TFT_DC, TFT_RST, -1, TFT_BLK);

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n=== ST7789_ESP32_7PIN v2.0 DIAGNOSTIC ===");
  Serial.println("SPI MODE: 0");
  Serial.println("Panel: 240x240");
  Serial.println("CS: not used");

  tft.begin(240, 240, true, 40000000UL);
  tft.setBacklight(true);
  tft.setRotation(0);
  tft.invertDisplay(true);

  Serial.println("INIT COMPLETE");

  Serial.println("RED");
  tft.fillScreen(ST77XX_RED); delay(1200);
  Serial.println("GREEN");
  tft.fillScreen(ST77XX_GREEN); delay(1200);
  Serial.println("BLUE");
  tft.fillScreen(ST77XX_BLUE); delay(1200);
  Serial.println("WHITE");
  tft.fillScreen(ST77XX_WHITE); delay(1200);
  Serial.println("BLACK + TEXT");

  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(42, 90);
  tft.print("ST7789 OK");
  tft.setTextSize(1);
  tft.setCursor(55, 120);
  tft.print("ESP32-C3 / SPI MODE0");

  Serial.println("TEST COMPLETE");
}

void loop() {
  static uint32_t last = 0;
  if (millis() - last >= 1000) {
    last = millis();
    Serial.printf("RUNNING  uptime=%lus\n", millis() / 1000UL);
  }
}
