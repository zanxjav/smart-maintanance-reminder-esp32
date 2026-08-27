#include <ST7789_ESP32.h>

#define TFT_SCLK 4
#define TFT_MOSI 6
#define TFT_DC   10
#define TFT_RST  7
#define TFT_BLK  5

ST7789_ESP32 display(TFT_SCLK, TFT_MOSI, TFT_DC, TFT_RST, -1, TFT_BLK);

void setup() {
  Serial.begin(115200);
  delay(1000);

  display.begin(240, 240, true, 40000000UL);
  display.setRotation(0);
  display.setBacklight(true);
  display.invertDisplay(true);

  display.fillScreen(0x0842);
  display.fillRoundRect(6, 6, 228, 30, 6, 0x10E4);
  display.drawRoundRect(6, 6, 228, 30, 6, 0x2988);
  display.setTextSize(1);
  display.setTextColor(0x07FF);
  display.setCursor(14, 18);
  display.print("VEHICLE MONITOR");

  display.fillRoundRect(6, 42, 228, 118, 10, 0x10E4);
  display.drawRoundRect(6, 42, 228, 118, 10, 0x2988);

  display.setTextColor(0xFFFF);
  display.setTextSize(7);
  display.setCursor(74, 62);
  display.print("60");

  display.setTextSize(2);
  display.setTextColor(0x9514);
  display.setCursor(94, 130);
  display.print("KM/H");

  display.fillRoundRect(6, 168, 111, 66, 8, 0x10E4);
  display.drawRoundRect(6, 168, 111, 66, 8, 0x2988);
  display.fillRoundRect(123, 168, 111, 66, 8, 0x10E4);
  display.drawRoundRect(123, 168, 111, 66, 8, 0x2988);

  display.setTextSize(1);
  display.setTextColor(0x9514);
  display.setCursor(14, 176);
  display.print("TOTAL ODO");
  display.setCursor(131, 176);
  display.print("TRIP METER");

  display.setTextSize(2);
  display.setTextColor(0xFFFF);
  display.setCursor(14, 195);
  display.print("97248");
  display.setCursor(131, 195);
  display.print("0.0");
}

void loop() {}
