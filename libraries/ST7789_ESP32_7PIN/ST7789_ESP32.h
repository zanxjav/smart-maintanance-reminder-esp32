#ifndef ST7789_ESP32_H
#define ST7789_ESP32_H

#include <Arduino.h>
#include <SPI.h>
#include <Print.h>

// ============================================================
// ST7789 COMMAND DEFINITIONS
// ============================================================
#define ST7789_NOP        0x00
#define ST7789_SWRESET    0x01
#define ST7789_RDDID      0x04
#define ST7789_RDDST      0x09
#define ST7789_SLPIN      0x10
#define ST7789_SLPOUT     0x11
#define ST7789_PTLON      0x12
#define ST7789_NORON      0x13
#define ST7789_INVOFF     0x20
#define ST7789_INVON      0x21
#define ST7789_DISPOFF    0x28
#define ST7789_DISPON     0x29
#define ST7789_CASET      0x2A
#define ST7789_RASET      0x2B
#define ST7789_RAMWR      0x2C
#define ST7789_RAMRD      0x2E
#define ST7789_PTLAR      0x30
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

// MADCTL Bits
#define ST7789_MADCTL_MY  0x80
#define ST7789_MADCTL_MX  0x40
#define ST7789_MADCTL_MV  0x20
#define ST7789_MADCTL_ML  0x10
#define ST7789_MADCTL_BGR 0x08
#define ST7789_MADCTL_MH  0x04
#define ST7789_MADCTL_RGB 0x00

// ============================================================
// COLOR CONSTANTS (16-BIT RGB565)
// ============================================================
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

// ST77XX Compatibility Aliases
#define ST77XX_BLACK      COLOR_BLACK
#define ST77XX_WHITE      COLOR_WHITE
#define ST77XX_RED        COLOR_RED
#define ST77XX_GREEN      COLOR_GREEN
#define ST77XX_BLUE       COLOR_BLUE
#define ST77XX_CYAN       COLOR_CYAN
#define ST77XX_MAGENTA    COLOR_MAGENTA
#define ST77XX_YELLOW     COLOR_YELLOW
#define ST77XX_ORANGE     COLOR_ORANGE

class ST7789_ESP32 : public Print {
public:
    // Constructor untuk modul TFT ST7789 7-pin tanpa CS (atau dengan CS opsional)
    // SCLK/SCL, MOSI/SDA, DC/RS, RST/RES, CS (opsional default -1), BLK/LED (opsional default -1)
    ST7789_ESP32(int8_t sclk, int8_t mosi, int8_t dc, int8_t rst = -1, int8_t cs = -1, int8_t blk = -1);

    // Initialization
    void begin(uint16_t w = 240, uint16_t h = 240, bool useHwSPI = true, uint32_t freq = 40000000);
    void init(uint16_t w = 240, uint16_t h = 240); // Alias for Adafruit compatibility

    // Display Control
    void setRotation(uint8_t m);
    void invertDisplay(bool invert);
    void setBacklight(bool on);
    void setBacklightBrightness(uint8_t brightness); // 0-255 PWM (ESP32 ledc)
    void sleepDisplay(bool sleep);

    // Coordinate Offsets (untuk penyesuaian panel 240x240 / 240x320)
    void setOffsets(int16_t colOffset, int16_t rowOffset);

    // Screen Dimensions
    int16_t width()  const { return _width; }
    int16_t height() const { return _height; }
    uint8_t getRotation() const { return _rotation; }

    // Color conversion
    static inline uint16_t color565(uint8_t r, uint8_t g, uint8_t b) {
        return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
    }

    // Basic Graphics Primitives
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
    void drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);
    void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);

    // Text & Font Engine
    void setCursor(int16_t x, int16_t y);
    void setTextColor(uint16_t color);
    void setTextColor(uint16_t color, uint16_t bg);
    void setTextSize(uint8_t size);
    void setTextWrap(bool wrap);
    void drawChar(int16_t x, int16_t y, unsigned char c, uint16_t color, uint16_t bg, uint8_t size);
    void getTextBounds(const char* str, int16_t x, int16_t y, int16_t* x1, int16_t* y1, uint16_t* w, uint16_t* h);

    // Print interface implementation
    virtual size_t write(uint8_t c) override;

    // Window Address helper
    void setAddrWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);

private:
    int8_t _sclk, _mosi, _dc, _rst, _cs, _blk;
    uint16_t _width, _height;
    uint8_t _rotation;
    int16_t _colstart, _rowstart;
    int16_t _customColOffset, _customRowOffset;
    int16_t _cursor_x, _cursor_y;
    uint16_t _textcolor, _textbgcolor;
    uint8_t _textsize;
    bool _wrap;
    bool _useHwSPI;
    uint32_t _spiFreq;
    SPIClass* _spi;
    SPISettings _spiSettings;

    void writeCommand(uint8_t cmd);
    void writeData(uint8_t data);
    void writeData16(uint16_t data);
    void writeColor(uint16_t color, uint32_t count);
    void spiWriteByteBitBang(uint8_t b);

    // Circle & RoundRect Helpers
    void drawCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, uint16_t color);
    void fillCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, int16_t delta, uint16_t color);
};

#endif // ST7789_ESP32_H
