#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>

// ST7789 commands
#define ST7789_NOP        0x00
#define ST7789_SWRESET    0x01
#define ST7789_RDDID      0x04
#define ST7789_RDDST      0x09
#define ST7789_SLPIN      0x10
#define ST7789_SLPOUT     0x11
#define ST7789_NORON      0x13
#define ST7789_INVOFF     0x20
#define ST7789_INVON      0x21
#define ST7789_DISPOFF    0x28
#define ST7789_DISPON     0x29
#define ST7789_CASET      0x2A
#define ST7789_RASET      0x2B
#define ST7789_RAMWR      0x2C
#define ST7789_RAMRD      0x2E
#define ST7789_MADCTL     0x36
#define ST7789_COLMOD     0x3A
#define ST7789_PORCTRL    0xB2
#define ST7789_GCTRL      0xB7
#define ST7789_VCOMS      0xBB
#define ST7789_LCMCTRL    0xC0
#define ST7789_VDVVRHEN   0xC2
#define ST7789_VRHS       0xC3
#define ST7789_VDVS       0xC4
#define ST7789_FRCTRL2    0xC6
#define ST7789_PWCTRL1    0xD0
#define ST7789_PVGAMCTRL  0xE0
#define ST7789_NVGAMCTRL  0xE1

// MADCTL bits
#define ST7789_MADCTL_MY  0x80
#define ST7789_MADCTL_MX  0x40
#define ST7789_MADCTL_MV  0x20
#define ST7789_MADCTL_ML  0x10
#define ST7789_MADCTL_BGR 0x08
#define ST7789_MADCTL_MH  0x04

// RGB565 colors
#define COLOR_BLACK       0x0000
#define COLOR_NAVY        0x000F
#define COLOR_DARKGREEN   0x03E0
#define COLOR_DARKCYAN    0x03EF
#define COLOR_MAROON      0x7800
#define COLOR_PURPLE      0x780F
#define COLOR_OLIVE       0x7BE0
#define COLOR_LIGHTGREY   0xC618
#define COLOR_DARKGREY    0x7BEF
#define COLOR_BLUE        0x001F
#define COLOR_GREEN       0x07E0
#define COLOR_CYAN        0x07FF
#define COLOR_RED         0xF800
#define COLOR_MAGENTA     0xF81F
#define COLOR_YELLOW      0xFFE0
#define COLOR_WHITE       0xFFFF
#define COLOR_ORANGE      0xFDA0
#define COLOR_GREENYELLOW 0xB7E0
#define COLOR_PINK        0xFC9F

// Compatibility aliases
#ifndef ST77XX_BLACK
#define ST77XX_BLACK   COLOR_BLACK
#define ST77XX_WHITE   COLOR_WHITE
#define ST77XX_RED     COLOR_RED
#define ST77XX_GREEN   COLOR_GREEN
#define ST77XX_BLUE    COLOR_BLUE
#define ST77XX_CYAN    COLOR_CYAN
#define ST77XX_MAGENTA COLOR_MAGENTA
#define ST77XX_YELLOW  COLOR_YELLOW
#define ST77XX_ORANGE  COLOR_ORANGE
#endif

class ST7789_ESP32 : public Adafruit_GFX {
public:
  // SCLK, MOSI, DC, RST, CS(optional=-1), BLK(optional=-1)
  ST7789_ESP32(int8_t sclk, int8_t mosi, int8_t dc,
               int8_t rst = -1, int8_t cs = -1, int8_t blk = -1);

  // Standard init: hardware SPI, 40 MHz, offsets auto-selected for panel size.
  void begin(uint16_t w = 240, uint16_t h = 240,
             bool useHwSPI = true, uint32_t freq = 40000000UL);
  void init(uint16_t w = 240, uint16_t h = 240);

  void setRotation(uint8_t m) override;
  void invertDisplay(bool invert);
  void setBacklight(bool on);
  void setBacklightBrightness(uint8_t brightness);
  void sleepDisplay(bool sleep);
  void setOffsets(int16_t colOffset, int16_t rowOffset);

  // Diagnostics
  bool isInitialized() const { return _initialized; }
  bool usingHardwareSPI() const { return _useHwSPI; }
  uint32_t spiFrequency() const { return _spiFreq; }

  // Adafruit_GFX low-level drawing hooks
  void drawPixel(int16_t x, int16_t y, uint16_t color) override;
  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;
  void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;

  // Public window helper
  void setAddrWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);

  static constexpr uint16_t color565(uint8_t r, uint8_t g, uint8_t b) {
    return ((uint16_t)(r & 0xF8) << 8) |
           ((uint16_t)(g & 0xFC) << 3) |
           ((uint16_t)b >> 3);
  }

private:
  int8_t _sclk, _mosi, _dc, _rst, _cs, _blk;
  uint16_t _panelW, _panelH;
  int16_t _colstart, _rowstart;
  int16_t _customColOffset, _customRowOffset;
  bool _useHwSPI;
  bool _initialized;
  uint32_t _spiFreq;
  SPIClass *_spi;
  SPISettings _spiSettings;

  void writeCommand(uint8_t cmd);
  void writeData(uint8_t data);
  void writeDataBytes(const uint8_t *data, size_t len);
  void writeColor(uint16_t color, uint32_t count);
  void spiWriteByte(uint8_t b);
  void select();
  void deselect();
  void beginWrite();
  void endWrite();
  void setAddrWindowRaw(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);
  void resetDisplay();
  void initSequence();
};
