#ifndef ST7789_ESP32_7PIN_LITE_H
#define ST7789_ESP32_7PIN_LITE_H

#include <Arduino.h>
#include <SPI.h>
#include <Print.h>

#define ST7789_NOP      0x00
#define ST7789_SWRESET  0x01
#define ST7789_SLPOUT   0x11
#define ST7789_NORON    0x13
#define ST7789_INVOFF   0x20
#define ST7789_INVON    0x21
#define ST7789_DISPOFF  0x28
#define ST7789_DISPON   0x29
#define ST7789_CASET    0x2A
#define ST7789_RASET    0x2B
#define ST7789_RAMWR    0x2C
#define ST7789_MADCTL   0x36
#define ST7789_COLMOD   0x3A
#define ST7789_PORCTRL  0xB2
#define ST7789_GCTRL    0xB7
#define ST7789_VCOMS    0xBB
#define ST7789_LCMCTRL  0xC0
#define ST7789_VDVVRHEN 0xC2
#define ST7789_VRHS     0xC3
#define ST7789_VDVS     0xC4
#define ST7789_FRCTRL2  0xC6
#define ST7789_PWCTRL1  0xD0
#define ST7789_PVGAMCTRL 0xE0
#define ST7789_NVGAMCTRL 0xE1

#define ST77XX_BLACK   0x0000
#define ST77XX_BLUE    0x001F
#define ST77XX_RED     0xF800
#define ST77XX_GREEN   0x07E0
#define ST77XX_CYAN    0x07FF
#define ST77XX_MAGENTA 0xF81F
#define ST77XX_YELLOW  0xFFE0
#define ST77XX_WHITE   0xFFFF
#define ST77XX_ORANGE  0xFDA0
#define ST77XX_GRAY    0x8410

// Automotive theme aliases
#define COLOR_BG          0x0000
#define COLOR_CARD_BG     0x10E4
#define COLOR_BORDER      0x2988
#define COLOR_CYAN        0x07FF
#define COLOR_GREEN       0x07E0
#define COLOR_AMBER       0xFDA0
#define COLOR_RED         0xF800
#define COLOR_WHITE       0xFFFF
#define COLOR_TEXT_MUTED  0x8410

class ST7789_ESP32_7PIN_Lite : public Print {
public:
  ST7789_ESP32_7PIN_Lite(int8_t sclk, int8_t mosi, int8_t dc,
                         int8_t rst = -1, int8_t cs = -1, int8_t blk = -1);

  void begin(uint16_t width = 240, uint16_t height = 240,
             bool hardwareSPI = true, uint32_t frequency = 20000000UL);
  void init(uint16_t width = 240, uint16_t height = 240) { begin(width, height, true, 20000000UL); }

  void setRotation(uint8_t rotation);
  void invertDisplay(bool invert);
  void setBacklight(bool on);
  void setBacklightBrightness(uint8_t brightness);
  void sleepDisplay(bool sleep);
  void setOffsets(int16_t x, int16_t y);

  int16_t width() const { return _width; }
  int16_t height() const { return _height; }
  uint8_t getRotation() const { return _rotation; }

  static uint16_t color565(uint8_t r, uint8_t g, uint8_t b) {
    return ((uint16_t)(r & 0xF8) << 8) | ((uint16_t)(g & 0xFC) << 3) | (b >> 3);
  }

  void fillScreen(uint16_t color);
  void drawPixel(int16_t x, int16_t y, uint16_t color);
  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color);
  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color);
  void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
  void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
  void drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color);
  void fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color);
  void drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color);
  void fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color);

  void setCursor(int16_t x, int16_t y);
  void setTextColor(uint16_t color);
  void setTextColor(uint16_t color, uint16_t bg);
  void setTextSize(uint8_t size);
  void setTextWrap(bool wrap);
  void getTextBounds(const char *str, int16_t x, int16_t y,
                     int16_t *x1, int16_t *y1, uint16_t *w, uint16_t *h);
  void drawChar(int16_t x, int16_t y, unsigned char c, uint16_t color,
                uint16_t bg, uint8_t size);
  size_t write(uint8_t c) override;

private:
  int8_t _sclk, _mosi, _dc, _rst, _cs, _blk;
  uint16_t _width, _height;
  uint8_t _rotation;
  int16_t _xOffset, _yOffset;
  int16_t _cursorX, _cursorY;
  uint16_t _textColor, _textBg;
  uint8_t _textSize;
  bool _wrap;
  bool _hardwareSPI;
  uint32_t _spiFrequency;
  SPIClass *_spi;
  SPISettings _spiSettings;

  void hardwareReset();
  void writeCommand(uint8_t command);
  void writeData(uint8_t data);
  void writeDataBuffer(const uint8_t *data, size_t len);
  void writeColor(uint16_t color, uint32_t pixels);
  void setAddrWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);
  void bitBangByte(uint8_t data);
  void drawCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, uint16_t color);
  void fillCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, int16_t delta, uint16_t color);
};

#endif // ST7789_ESP32_7PIN_LITE_H
