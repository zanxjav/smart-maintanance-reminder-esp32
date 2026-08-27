#include "ST7789_ESP32.h"

// ============================================================
// STANDARD 5x7 ASCII FONT TABLE (32 - 127)
// ============================================================
static const unsigned char font5x7[] PROGMEM = {
    0x00, 0x00, 0x00, 0x00, 0x00, // (space)
    0x00, 0x00, 0x5F, 0x00, 0x00, // !
    0x00, 0x07, 0x00, 0x07, 0x00, // "
    0x14, 0x7F, 0x14, 0x7F, 0x14, // #
    0x24, 0x2A, 0x7F, 0x2A, 0x12, // $
    0x23, 0x13, 0x08, 0x64, 0x62, // %
    0x36, 0x49, 0x55, 0x22, 0x50, // &
    0x00, 0x05, 0x03, 0x00, 0x00, // '
    0x00, 0x1C, 0x22, 0x41, 0x00, // (
    0x00, 0x41, 0x22, 0x1C, 0x00, // )
    0x08, 0x2A, 0x1C, 0x2A, 0x08, // *
    0x08, 0x08, 0x3E, 0x08, 0x08, // +
    0x00, 0x50, 0x30, 0x00, 0x00, // ,
    0x08, 0x08, 0x08, 0x08, 0x08, // -
    0x00, 0x60, 0x60, 0x00, 0x00, // .
    0x20, 0x10, 0x08, 0x04, 0x02, // /
    0x3E, 0x51, 0x49, 0x45, 0x3E, // 0
    0x00, 0x42, 0x7F, 0x40, 0x00, // 1
    0x42, 0x61, 0x51, 0x49, 0x46, // 2
    0x21, 0x41, 0x45, 0x4B, 0x31, // 3
    0x18, 0x14, 0x12, 0x7F, 0x10, // 4
    0x27, 0x45, 0x45, 0x45, 0x39, // 5
    0x3C, 0x4A, 0x49, 0x49, 0x30, // 6
    0x01, 0x71, 0x09, 0x05, 0x03, // 7
    0x36, 0x49, 0x49, 0x49, 0x36, // 8
    0x06, 0x49, 0x49, 0x29, 0x1E, // 9
    0x00, 0x36, 0x36, 0x00, 0x00, // :
    0x00, 0x56, 0x36, 0x00, 0x00, // ;
    0x00, 0x08, 0x14, 0x22, 0x41, // <
    0x14, 0x14, 0x14, 0x14, 0x14, // =
    0x41, 0x22, 0x14, 0x08, 0x00, // >
    0x02, 0x01, 0x51, 0x09, 0x06, // ?
    0x32, 0x49, 0x79, 0x41, 0x3E, // @
    0x7E, 0x11, 0x11, 0x11, 0x7E, // A
    0x7F, 0x49, 0x49, 0x49, 0x36, // B
    0x3E, 0x41, 0x41, 0x41, 0x22, // C
    0x7F, 0x41, 0x41, 0x22, 0x1C, // D
    0x7F, 0x49, 0x49, 0x49, 0x41, // E
    0x7F, 0x09, 0x09, 0x01, 0x01, // F
    0x3E, 0x41, 0x41, 0x51, 0x32, // G
    0x7F, 0x08, 0x08, 0x08, 0x7F, // H
    0x00, 0x41, 0x7F, 0x41, 0x00, // I
    0x20, 0x40, 0x41, 0x3F, 0x01, // J
    0x7F, 0x08, 0x14, 0x22, 0x41, // K
    0x7F, 0x40, 0x40, 0x40, 0x40, // L
    0x7F, 0x02, 0x04, 0x02, 0x7F, // M
    0x7F, 0x04, 0x08, 0x10, 0x7F, // N
    0x3E, 0x41, 0x41, 0x41, 0x3E, // O
    0x7F, 0x09, 0x09, 0x09, 0x06, // P
    0x3E, 0x41, 0x51, 0x21, 0x5E, // Q
    0x7F, 0x09, 0x19, 0x29, 0x46, // R
    0x46, 0x49, 0x49, 0x49, 0x31, // S
    0x01, 0x01, 0x7F, 0x01, 0x01, // T
    0x3F, 0x40, 0x40, 0x40, 0x3F, // U
    0x1F, 0x20, 0x40, 0x20, 0x1F, // V
    0x7F, 0x20, 0x18, 0x20, 0x7F, // W
    0x63, 0x14, 0x08, 0x14, 0x63, // X
    0x03, 0x04, 0x78, 0x04, 0x03, // Y
    0x61, 0x51, 0x49, 0x45, 0x43, // Z
    0x00, 0x7F, 0x41, 0x41, 0x00, // [
    0x02, 0x04, 0x08, 0x10, 0x20, // \
    0x00, 0x41, 0x41, 0x7F, 0x00, // ]
    0x04, 0x02, 0x01, 0x02, 0x04, // ^
    0x40, 0x40, 0x40, 0x40, 0x40, // _
    0x00, 0x01, 0x02, 0x04, 0x00, // `
    0x20, 0x54, 0x54, 0x54, 0x78, // a
    0x7F, 0x48, 0x44, 0x44, 0x38, // b
    0x38, 0x44, 0x44, 0x44, 0x20, // c
    0x38, 0x44, 0x44, 0x48, 0x7F, // d
    0x38, 0x54, 0x54, 0x54, 0x18, // e
    0x08, 0x7E, 0x09, 0x01, 0x02, // f
    0x08, 0x14, 0x54, 0x54, 0x3C, // g
    0x7F, 0x08, 0x04, 0x04, 0x78, // h
    0x00, 0x44, 0x7D, 0x40, 0x00, // i
    0x20, 0x40, 0x44, 0x3D, 0x00, // j
    0x7F, 0x10, 0x28, 0x44, 0x00, // k
    0x00, 0x41, 0x7F, 0x40, 0x00, // l
    0x7C, 0x04, 0x18, 0x04, 0x78, // m
    0x7C, 0x08, 0x04, 0x04, 0x78, // n
    0x38, 0x44, 0x44, 0x44, 0x38, // o
    0x7C, 0x14, 0x14, 0x14, 0x08, // p
    0x08, 0x14, 0x14, 0x18, 0x7C, // q
    0x7C, 0x08, 0x04, 0x04, 0x08, // r
    0x48, 0x54, 0x54, 0x54, 0x20, // s
    0x04, 0x3F, 0x44, 0x40, 0x20, // t
    0x3C, 0x40, 0x40, 0x20, 0x7C, // u
    0x1C, 0x20, 0x40, 0x20, 0x1C, // v
    0x3C, 0x40, 0x30, 0x40, 0x3C, // w
    0x44, 0x28, 0x10, 0x28, 0x44, // x
    0x0C, 0x50, 0x50, 0x50, 0x3C, // y
    0x44, 0x64, 0x54, 0x4C, 0x44, // z
    0x00, 0x08, 0x36, 0x41, 0x00, // {
    0x00, 0x00, 0x7F, 0x00, 0x00, // |
    0x00, 0x41, 0x36, 0x08, 0x00, // }
    0x08, 0x08, 0x2A, 0x1C, 0x08  // ~
};

// ============================================================
// CONSTRUCTOR
// ============================================================
ST7789_ESP32::ST7789_ESP32(int8_t sclk, int8_t mosi, int8_t dc, int8_t rst, int8_t cs, int8_t blk) {
    _sclk = sclk;
    _mosi = mosi;
    _dc   = dc;
    _rst  = rst;
    _cs   = cs;
    _blk  = blk;

    _width = 240;
    _height = 240;
    _rotation = 0;
    _colstart = 0;
    _rowstart = 0;
    _customColOffset = 0;
    _customRowOffset = 0;

    _cursor_x = 0;
    _cursor_y = 0;
    _textcolor = COLOR_WHITE;
    _textbgcolor = COLOR_BLACK;
    _textsize = 1;
    _wrap = true;

    _useHwSPI = true;
    _spiFreq = 40000000;
    _spi = nullptr;
}

// ============================================================
// LOW-LEVEL SPI / PIN COMMUNICATION
// ============================================================
void IRAM_ATTR ST7789_ESP32::spiWriteByteBitBang(uint8_t b) {
    for (uint8_t i = 0; i < 8; i++) {
        digitalWrite(_sclk, LOW);
        if (b & 0x80) digitalWrite(_mosi, HIGH);
        else digitalWrite(_mosi, LOW);
        digitalWrite(_sclk, HIGH);
        b <<= 1;
    }
}

void ST7789_ESP32::writeCommand(uint8_t cmd) {
    digitalWrite(_dc, LOW);
    if (_cs >= 0) digitalWrite(_cs, LOW);

    if (_useHwSPI && _spi) {
        _spi->beginTransaction(_spiSettings);
        _spi->transfer(cmd);
        _spi->endTransaction();
    } else {
        spiWriteByteBitBang(cmd);
    }

    if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32::writeData(uint8_t data) {
    digitalWrite(_dc, HIGH);
    if (_cs >= 0) digitalWrite(_cs, LOW);

    if (_useHwSPI && _spi) {
        _spi->beginTransaction(_spiSettings);
        _spi->transfer(data);
        _spi->endTransaction();
    } else {
        spiWriteByteBitBang(data);
    }

    if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32::writeData16(uint16_t data) {
    digitalWrite(_dc, HIGH);
    if (_cs >= 0) digitalWrite(_cs, LOW);

    if (_useHwSPI && _spi) {
        _spi->beginTransaction(_spiSettings);
        _spi->transfer(data >> 8);
        _spi->transfer(data & 0xFF);
        _spi->endTransaction();
    } else {
        spiWriteByteBitBang(data >> 8);
        spiWriteByteBitBang(data & 0xFF);
    }

    if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32::writeColor(uint16_t color, uint32_t count) {
    if (count == 0) return;
    digitalWrite(_dc, HIGH);
    if (_cs >= 0) digitalWrite(_cs, LOW);

    if (_useHwSPI && _spi) {
        _spi->beginTransaction(_spiSettings);
        #if defined(ESP32)
        uint8_t hi = color >> 8;
        uint8_t lo = color & 0xFF;
        uint8_t buf[128];
        for (int i = 0; i < 64; i++) {
            buf[i * 2]     = hi;
            buf[i * 2 + 1] = lo;
        }
        while (count > 0) {
            uint32_t batch = (count > 64) ? 64 : count;
            _spi->transferBytes(buf, nullptr, batch * 2);
            count -= batch;
        }
        #else
        while (count--) {
            _spi->transfer(color >> 8);
            _spi->transfer(color & 0xFF);
        }
        #endif
        _spi->endTransaction();
    } else {
        uint8_t hi = color >> 8;
        uint8_t lo = color & 0xFF;
        while (count--) {
            spiWriteByteBitBang(hi);
            spiWriteByteBitBang(lo);
        }
    }

    if (_cs >= 0) digitalWrite(_cs, HIGH);
}

// ============================================================
// INITIALIZATION
// ============================================================
void ST7789_ESP32::begin(uint16_t w, uint16_t h, bool useHwSPI, uint32_t freq) {
    _width = w;
    _height = h;
    _useHwSPI = useHwSPI;
    _spiFreq = freq;

    // 1. Backlight
    if (_blk >= 0) {
        pinMode(_blk, OUTPUT);
        digitalWrite(_blk, HIGH);
    }

    // 2. Control Pins
    pinMode(_dc, OUTPUT);
    digitalWrite(_dc, HIGH);

    if (_cs >= 0) {
        pinMode(_cs, OUTPUT);
        digitalWrite(_cs, HIGH);
    }

    // 3. SPI Pins setup
    if (_useHwSPI) {
        _spi = &SPI;
        // On ESP32, SPI.begin takes (sclk, miso, mosi, ss)
        #if defined(ESP32)
        _spi->begin(_sclk, -1, _mosi, (_cs >= 0 ? _cs : -1));
        #else
        _spi->begin();
        #endif
        _spiSettings = SPISettings(_spiFreq, MSBFIRST, SPI_MODE3);
    } else {
        pinMode(_sclk, OUTPUT);
        pinMode(_mosi, OUTPUT);
        digitalWrite(_sclk, HIGH);
        digitalWrite(_mosi, LOW);
    }

    // 4. Hardware Reset Sequence
    if (_rst >= 0) {
        pinMode(_rst, OUTPUT);
        digitalWrite(_rst, HIGH);
        delay(20);
        digitalWrite(_rst, LOW);
        delay(100);
        digitalWrite(_rst, HIGH);
        delay(150);
    } else {
        delay(150);
    }

    // 5. Software Reset
    writeCommand(ST7789_SWRESET);
    delay(150);

    // 6. Sleep Out
    writeCommand(ST7789_SLPOUT);
    delay(120);

    // 7. Color Mode: 16-bit / pixel RGB565
    writeCommand(ST7789_COLMOD);
    writeData(0x55);
    delay(10);

    // 8. Porch Setting
    writeCommand(ST7789_PORCTRL);
    writeData(0x0C);
    writeData(0x0C);
    writeData(0x00);
    writeData(0x33);
    writeData(0x33);

    // 9. Gate Control
    writeCommand(ST7789_GCTRL);
    writeData(0x35);

    // 10. VCOM Setting
    writeCommand(ST7789_VCOMS);
    writeData(0x19);

    // 11. LCM Control
    writeCommand(ST7789_LCMCTRL);
    writeData(0x2C);

    // 12. VDV and VRH Command Enable
    writeCommand(ST7789_VDVVRHEN);
    writeData(0x01);

    // 13. VRH Set
    writeCommand(ST7789_VRHS);
    writeData(0x12);

    // 14. VDV Set
    writeCommand(ST7789_VDVS);
    writeData(0x20);

    // 15. Frame Rate Control (60Hz)
    writeCommand(ST7789_FRCTRL2);
    writeData(0x0F);

    // 16. Power Control 1
    writeCommand(ST7789_PWCTRL1);
    writeData(0xA4);
    writeData(0xA1);

    // 17. Positive Gamma Control
    writeCommand(ST7789_PVGAMCTRL);
    writeData(0xD0);
    writeData(0x04);
    writeData(0x0D);
    writeData(0x11);
    writeData(0x13);
    writeData(0x2B);
    writeData(0x3F);
    writeData(0x54);
    writeData(0x4C);
    writeData(0x18);
    writeData(0x0D);
    writeData(0x0B);
    writeData(0x1F);
    writeData(0x23);

    // 18. Negative Gamma Control
    writeCommand(ST7789_NVGAMCTRL);
    writeData(0xD0);
    writeData(0x04);
    writeData(0x0C);
    writeData(0x11);
    writeData(0x13);
    writeData(0x2C);
    writeData(0x3F);
    writeData(0x44);
    writeData(0x51);
    writeData(0x2F);
    writeData(0x1F);
    writeData(0x1F);
    writeData(0x20);
    writeData(0x23);

    // 19. Display Inversion ON (Required for ST7789 IPS panels)
    writeCommand(ST7789_INVON);
    delay(10);

    // 20. Default Rotation
    setRotation(0);

    // 21. Display ON
    writeCommand(ST7789_DISPON);
    delay(120);

    // 22. Clear to Black
    fillScreen(COLOR_BLACK);
}

void ST7789_ESP32::init(uint16_t w, uint16_t h) {
    begin(w, h, true, 40000000);
}

// ============================================================
// DISPLAY CONFIGURATION
// ============================================================
void ST7789_ESP32::setRotation(uint8_t m) {
    _rotation = m % 4;
    writeCommand(ST7789_MADCTL);
    switch (_rotation) {
        case 0: // Portrait
            writeData(0x00);
            _colstart = 0 + _customColOffset;
            _rowstart = 0 + _customRowOffset;
            _width  = 240;
            _height = 240;
            break;
        case 1: // Landscape (90 deg)
            writeData(ST7789_MADCTL_MX | ST7789_MADCTL_MV);
            _colstart = 0 + _customColOffset;
            _rowstart = 0 + _customRowOffset;
            _width  = 240;
            _height = 240;
            break;
        case 2: // Inverted Portrait (180 deg)
            writeData(ST7789_MADCTL_MX | ST7789_MADCTL_MY);
            _colstart = 0 + _customColOffset;
            _rowstart = 80 + _customRowOffset;
            _width  = 240;
            _height = 240;
            break;
        case 3: // Inverted Landscape (270 deg)
            writeData(ST7789_MADCTL_MY | ST7789_MADCTL_MV);
            _colstart = 80 + _customColOffset;
            _rowstart = 0 + _customRowOffset;
            _width  = 240;
            _height = 240;
            break;
    }
}

void ST7789_ESP32::setOffsets(int16_t colOffset, int16_t rowOffset) {
    _customColOffset = colOffset;
    _customRowOffset = rowOffset;
    setRotation(_rotation);
}

void ST7789_ESP32::invertDisplay(bool invert) {
    writeCommand(invert ? ST7789_INVON : ST7789_INVOFF);
}

void ST7789_ESP32::setBacklight(bool on) {
    if (_blk >= 0) {
        digitalWrite(_blk, on ? HIGH : LOW);
    }
}

void ST7789_ESP32::setBacklightBrightness(uint8_t brightness) {
    if (_blk >= 0) {
        #if defined(ESP32)
        // Configure PWM channel if supported or analogWrite
        analogWrite(_blk, brightness);
        #else
        analogWrite(_blk, brightness);
        #endif
    }
}

void ST7789_ESP32::sleepDisplay(bool sleep) {
    writeCommand(sleep ? ST7789_SLPIN : ST7789_SLPOUT);
    delay(120);
}

void ST7789_ESP32::setAddrWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
    uint16_t x_start = x0 + _colstart;
    uint16_t x_end   = x1 + _colstart;
    uint16_t y_start = y0 + _rowstart;
    uint16_t y_end   = y1 + _rowstart;

    writeCommand(ST7789_CASET);
    writeData(x_start >> 8);
    writeData(x_start & 0xFF);
    writeData(x_end >> 8);
    writeData(x_end & 0xFF);

    writeCommand(ST7789_RASET);
    writeData(y_start >> 8);
    writeData(y_start & 0xFF);
    writeData(y_end >> 8);
    writeData(y_end & 0xFF);

    writeCommand(ST7789_RAMWR);
}

// ============================================================
// GRAPHICS PRIMITIVES
// ============================================================
void ST7789_ESP32::fillScreen(uint16_t color) {
    fillRect(0, 0, _width, _height, color);
}

void ST7789_ESP32::drawPixel(int16_t x, int16_t y, uint16_t color) {
    if (x < 0 || x >= _width || y < 0 || y >= _height) return;
    setAddrWindow(x, y, x, y);
    writeColor(color, 1);
}

void ST7789_ESP32::drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    if (y < 0 || y >= _height || x >= _width || w <= 0) return;
    if (x < 0) { w += x; x = 0; }
    if (x + w > _width) w = _width - x;
    if (w <= 0) return;
    setAddrWindow(x, y, x + w - 1, y);
    writeColor(color, w);
}

void ST7789_ESP32::drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    if (x < 0 || x >= _width || y >= _height || h <= 0) return;
    if (y < 0) { h += y; y = 0; }
    if (y + h > _height) h = _height - y;
    if (h <= 0) return;
    setAddrWindow(x, y, x, y + h - 1);
    writeColor(color, h);
}

void ST7789_ESP32::fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (x >= _width || y >= _height || w <= 0 || h <= 0) return;
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > _width)  w = _width - x;
    if (y + h > _height) h = _height - y;
    if (w <= 0 || h <= 0) return;

    setAddrWindow(x, y, x + w - 1, y + h - 1);
    writeColor(color, (uint32_t)w * h);
}

void ST7789_ESP32::drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (w <= 0 || h <= 0) return;
    drawFastHLine(x, y, w, color);
    drawFastHLine(x, y + h - 1, w, color);
    drawFastVLine(x, y, h, color);
    drawFastVLine(x + w - 1, y, h, color);
}

void ST7789_ESP32::drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    int16_t steep = abs(y1 - y0) > abs(x1 - x0);
    if (steep) {
        int16_t t;
        t = x0; x0 = y0; y0 = t;
        t = x1; x1 = y1; y1 = t;
    }
    if (x0 > x1) {
        int16_t t;
        t = x0; x0 = x1; x1 = t;
        t = y0; y0 = y1; y1 = t;
    }

    int16_t dx = x1 - x0;
    int16_t dy = abs(y1 - y0);
    int16_t err = dx / 2;
    int16_t ystep = (y0 < y1) ? 1 : -1;

    for (; x0 <= x1; x0++) {
        if (steep) drawPixel(y0, x0, color);
        else       drawPixel(x0, y0, color);
        err -= dy;
        if (err < 0) {
            y0 += ystep;
            err += dx;
        }
    }
}

void ST7789_ESP32::drawCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, uint16_t color) {
    int16_t f = 1 - r;
    int16_t ddF_x = 1;
    int16_t ddF_y = -2 * r;
    int16_t x = 0;
    int16_t y = r;

    while (x < y) {
        if (f >= 0) {
            y--;
            ddF_y += 2;
            f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;
        if (cornername & 0x4) {
            drawPixel(x0 + x, y0 + y, color);
            drawPixel(x0 + y, y0 + x, color);
        }
        if (cornername & 0x2) {
            drawPixel(x0 + x, y0 - y, color);
            drawPixel(x0 + y, y0 - x, color);
        }
        if (cornername & 0x8) {
            drawPixel(x0 - y, y0 + x, color);
            drawPixel(x0 - x, y0 + y, color);
        }
        if (cornername & 0x1) {
            drawPixel(x0 - y, y0 - x, color);
            drawPixel(x0 - x, y0 - y, color);
        }
    }
}

void ST7789_ESP32::fillCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, int16_t delta, uint16_t color) {
    int16_t f = 1 - r;
    int16_t ddF_x = 1;
    int16_t ddF_y = -2 * r;
    int16_t x = 0;
    int16_t y = r;

    while (x < y) {
        if (f >= 0) {
            y--;
            ddF_y += 2;
            f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;

        if (cornername & 0x1) {
            drawFastVLine(x0 + x, y0 - y, 2 * y + 1 + delta, color);
            drawFastVLine(x0 + y, y0 - x, 2 * x + 1 + delta, color);
        }
        if (cornername & 0x2) {
            drawFastVLine(x0 - x, y0 - y, 2 * y + 1 + delta, color);
            drawFastVLine(x0 - y, y0 - x, 2 * x + 1 + delta, color);
        }
    }
}

void ST7789_ESP32::drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    int16_t f = 1 - r;
    int16_t ddF_x = 1;
    int16_t ddF_y = -2 * r;
    int16_t x = 0;
    int16_t y = r;

    drawPixel(x0, y0 + r, color);
    drawPixel(x0, y0 - r, color);
    drawPixel(x0 + r, y0, color);
    drawPixel(x0 - r, y0, color);

    while (x < y) {
        if (f >= 0) {
            y--;
            ddF_y += 2;
            f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;

        drawPixel(x0 + x, y0 + y, color);
        drawPixel(x0 - x, y0 + y, color);
        drawPixel(x0 + x, y0 - y, color);
        drawPixel(x0 - x, y0 - y, color);
        drawPixel(x0 + y, y0 + x, color);
        drawPixel(x0 - y, y0 + x, color);
        drawPixel(x0 + y, y0 - x, color);
        drawPixel(x0 - y, y0 - x, color);
    }
}

void ST7789_ESP32::fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    drawFastVLine(x0, y0 - r, 2 * r + 1, color);
    fillCircleHelper(x0, y0, r, 3, 0, color);
}

void ST7789_ESP32::drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    int16_t max_r = ((w < h) ? w : h) / 2;
    if (r > max_r) r = max_r;
    drawFastHLine(x + r, y, w - 2 * r, color);
    drawFastHLine(x + r, y + h - 1, w - 2 * r, color);
    drawFastVLine(x, y + r, h - 2 * r, color);
    drawFastVLine(x + w - 1, y + r, h - 2 * r, color);
    drawCircleHelper(x + r, y + r, r, 1, color);
    drawCircleHelper(x + w - r - 1, y + r, r, 2, color);
    drawCircleHelper(x + w - r - 1, y + h - r - 1, r, 4, color);
    drawCircleHelper(x + r, y + h - r - 1, r, 8, color);
}

void ST7789_ESP32::fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    int16_t max_r = ((w < h) ? w : h) / 2;
    if (r > max_r) r = max_r;
    fillRect(x + r, y, w - 2 * r, h, color);
    fillCircleHelper(x + w - r - 1, y + r, r, 1, h - 2 * r - 1, color);
    fillCircleHelper(x + r, y + r, r, 2, h - 2 * r - 1, color);
}

void ST7789_ESP32::drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
    drawLine(x0, y0, x1, y1, color);
    drawLine(x1, y1, x2, y2, color);
    drawLine(x2, y2, x0, y0, color);
}

void ST7789_ESP32::fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
    int16_t a, b, y, last;
    if (y0 > y1) { int16_t t = y0; y0 = y1; y1 = t; t = x0; x0 = x1; x1 = t; }
    if (y1 > y2) { int16_t t = y1; y1 = y2; y2 = t; t = x1; x1 = x2; x2 = t; }
    if (y0 > y1) { int16_t t = y0; y0 = y1; y1 = t; t = x0; x0 = x1; x1 = t; }

    if (y0 == y2) {
        a = b = x0;
        if (x1 < a) a = x1; else if (x1 > b) b = x1;
        if (x2 < a) a = x2; else if (x2 > b) b = x2;
        drawFastHLine(a, y0, b - a + 1, color);
        return;
    }

    int16_t dx01 = x1 - x0, dy01 = y1 - y0;
    int16_t dx02 = x2 - x0, dy02 = y2 - y0;
    int16_t dx12 = x2 - x1, dy12 = y2 - y1;
    int32_t sa = 0, sb = 0;

    last = (y1 == y2) ? y1 : y1 - 1;

    for (y = y0; y <= last; y++) {
        a = x0 + sa / dy01;
        b = x0 + sb / dy02;
        sa += dx01;
        sb += dx02;
        if (a > b) { int16_t t = a; a = b; b = t; }
        drawFastHLine(a, y, b - a + 1, color);
    }

    sa = (int32_t)dx12 * (y - y1);
    sb = (int32_t)dx02 * (y - y0);
    for (; y <= y2; y++) {
        a = x1 + sa / dy12;
        b = x0 + sb / dy02;
        sa += dx12;
        sb += dx02;
        if (a > b) { int16_t t = a; a = b; b = t; }
        drawFastHLine(a, y, b - a + 1, color);
    }
}

// ============================================================
// TEXT & FONT ENGINE
// ============================================================
void ST7789_ESP32::setCursor(int16_t x, int16_t y) {
    _cursor_x = x;
    _cursor_y = y;
}

void ST7789_ESP32::setTextColor(uint16_t color) {
    _textcolor = color;
    _textbgcolor = color; // transparent bg indicator
}

void ST7789_ESP32::setTextColor(uint16_t color, uint16_t bg) {
    _textcolor = color;
    _textbgcolor = bg;
}

void ST7789_ESP32::setTextSize(uint8_t size) {
    _textsize = (size > 0) ? size : 1;
}

void ST7789_ESP32::setTextWrap(bool wrap) {
    _wrap = wrap;
}

void ST7789_ESP32::drawChar(int16_t x, int16_t y, unsigned char c, uint16_t color, uint16_t bg, uint8_t size) {
    if (c < 32 || c > 127) c = 32;

    uint16_t fontOffset = (c - 32) * 5;

    for (int8_t i = 0; i < 5; i++) {
        uint8_t line = pgm_read_byte(&font5x7[fontOffset + i]);
        for (int8_t j = 0; j < 8; j++, line >>= 1) {
            if (line & 1) {
                if (size == 1) drawPixel(x + i, y + j, color);
                else fillRect(x + i * size, y + j * size, size, size, color);
            } else if (bg != color) {
                if (size == 1) drawPixel(x + i, y + j, bg);
                else fillRect(x + i * size, y + j * size, size, size, bg);
            }
        }
    }
    // 1-pixel column space after char
    if (bg != color) {
        if (size == 1) drawFastVLine(x + 5, y, 8, bg);
        else fillRect(x + 5 * size, y, size, 8 * size, bg);
    }
}

size_t ST7789_ESP32::write(uint8_t c) {
    if (c == '\n') {
        _cursor_x = 0;
        _cursor_y += _textsize * 8;
    } else if (c == '\r') {
        // ignore CR
    } else {
        if (_wrap && ((_cursor_x + _textsize * 6) > _width)) {
            _cursor_x = 0;
            _cursor_y += _textsize * 8;
        }
        drawChar(_cursor_x, _cursor_y, c, _textcolor, _textbgcolor, _textsize);
        _cursor_x += _textsize * 6;
    }
    return 1;
}

void ST7789_ESP32::getTextBounds(const char* str, int16_t x, int16_t y, int16_t* x1, int16_t* y1, uint16_t* w, uint16_t* h) {
    if (!str) {
        if (w) *w = 0;
        if (h) *h = 0;
        return;
    }
    uint16_t len = strlen(str);
    if (x1) *x1 = x;
    if (y1) *y1 = y;
    if (w) *w = len * 6 * _textsize;
    if (h) *h = 8 * _textsize;
}
