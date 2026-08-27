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
  delay(1000);
  tft.begin(240, 240, true, 20000000UL);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);

  tft.setTextColor(ST77XX_GREEN);
  tft.setTextSize(2);
  tft.setCursor(8, 8); tft.print("GPS: OK");
  tft.setTextColor(ST77XX_GRAY);
  tft.setCursor(158, 8); tft.print("18:51");

  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(7);
  tft.setCursor(58, 60); tft.print("0");
  tft.setTextSize(2);
  tft.setCursor(91, 125); tft.print("KM/H");

  tft.drawFastHLine(8, 150, 224, ST77XX_GRAY);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(8, 168);  tft.print("ODO");
  tft.setCursor(72, 168); tft.print("97248 km");
  tft.setCursor(8, 196);  tft.print("TRIP");
  tft.setCursor(72, 196); tft.print("0.0 km");
  tft.setTextColor(ST77XX_YELLOW);
  tft.setCursor(8, 224);  tft.print("LIMIT 60 KM/H");
}

void loop() {}
