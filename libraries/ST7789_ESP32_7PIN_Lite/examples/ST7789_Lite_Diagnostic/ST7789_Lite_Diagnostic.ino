#include <ST7789_ESP32_7PIN_Lite.h>

#define TFT_SCLK 4
#define TFT_MOSI 6
#define TFT_DC   10
#define TFT_RST  7
#define TFT_CS   -1
#define TFT_BLK  5

ST7789_ESP32_7PIN_Lite tft(TFT_SCLK, TFT_MOSI, TFT_DC, TFT_RST, TFT_CS, TFT_BLK);

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("ST7789 LITE DIAGNOSTIC");

  // Untuk pengujian paling bersih, BLK boleh dipindah langsung ke 3.3V.
  tft.begin(240, 240, true, 20000000UL);
  Serial.println("INIT DONE");

  tft.fillScreen(ST77XX_RED);   Serial.println("RED");   delay(1500);
  tft.fillScreen(ST77XX_GREEN); Serial.println("GREEN"); delay(1500);
  tft.fillScreen(ST77XX_BLUE);  Serial.println("BLUE");  delay(1500);
  tft.fillScreen(ST77XX_WHITE); Serial.println("WHITE"); delay(1500);

  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(3);
  tft.setCursor(42, 90);
  tft.print("TFT OK");
  Serial.println("TEXT OK");
}

void loop() {
  delay(1000);
  Serial.println("RUNNING");
}
