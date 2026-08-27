#include "ST7789_ESP32.h"

ST7789_ESP32::ST7789_ESP32(int8_t sclk, int8_t mosi, int8_t dc,
                           int8_t rst, int8_t cs, int8_t blk)
  : Adafruit_GFX(240, 240),
    _sclk(sclk), _mosi(mosi), _dc(dc), _rst(rst), _cs(cs), _blk(blk),
    _panelW(240), _panelH(240), _colstart(0), _rowstart(0),
    _customColOffset(0), _customRowOffset(0), _useHwSPI(true),
    _initialized(false), _spiFreq(40000000UL), _spi(&SPI),
    _spiSettings(40000000UL, MSBFIRST, SPI_MODE0) {}

void ST7789_ESP32::select() {
  if (_cs >= 0) digitalWrite(_cs, LOW);
}

void ST7789_ESP32::deselect() {
  if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32::beginWrite() {
  if (_useHwSPI && _spi) _spi->beginTransaction(_spiSettings);
  select();
}

void ST7789_ESP32::endWrite() {
  deselect();
  if (_useHwSPI && _spi) _spi->endTransaction();
}

void ST7789_ESP32::spiWriteByte(uint8_t b) {
  if (_useHwSPI && _spi) {
    _spi->transfer(b);
    return;
  }

  // SPI mode 0 bit-bang: clock idle LOW, data valid before rising edge.
  for (uint8_t mask = 0x80; mask; mask >>= 1) {
    digitalWrite(_mosi, (b & mask) ? HIGH : LOW);
    digitalWrite(_sclk, HIGH);
    digitalWrite(_sclk, LOW);
  }
}

void ST7789_ESP32::writeCommand(uint8_t cmd) {
  beginWrite();
  digitalWrite(_dc, LOW);
  spiWriteByte(cmd);
  endWrite();
}

void ST7789_ESP32::writeData(uint8_t data) {
  beginWrite();
  digitalWrite(_dc, HIGH);
  spiWriteByte(data);
  endWrite();
}

void ST7789_ESP32::writeDataBytes(const uint8_t *data, size_t len) {
  if (!data || !len) return;
  beginWrite();
  digitalWrite(_dc, HIGH);
  if (_useHwSPI && _spi) {
    _spi->writeBytes(data, len);
  } else {
    for (size_t i = 0; i < len; ++i) spiWriteByte(data[i]);
  }
  endWrite();
}

void ST7789_ESP32::writeColor(uint16_t color, uint32_t count) {
  if (!count) return;

  const uint8_t hi = color >> 8;
  const uint8_t lo = color & 0xFF;

  beginWrite();
  digitalWrite(_dc, HIGH);

  if (_useHwSPI && _spi) {
    uint8_t buffer[128]; // 64 RGB565 pixels
    for (uint16_t i = 0; i < sizeof(buffer); i += 2) {
      buffer[i] = hi;
      buffer[i + 1] = lo;
    }
    while (count) {
      uint32_t pixels = count > 64 ? 64 : count;
      _spi->writeBytes(buffer, pixels * 2);
      count -= pixels;
    }
  } else {
    while (count--) {
      spiWriteByte(hi);
      spiWriteByte(lo);
    }
  }

  endWrite();
}

void ST7789_ESP32::resetDisplay() {
  if (_rst < 0) {
    delay(10);
    return;
  }
  pinMode(_rst, OUTPUT);
  digitalWrite(_rst, HIGH);
  delay(10);
  digitalWrite(_rst, LOW);
  delay(120);
  digitalWrite(_rst, HIGH);
  delay(120);
}

void ST7789_ESP32::initSequence() {
  // Conservative ST7789 initialization compatible with common IPS 240x240
  // modules. SPI mode is explicitly MODE0.
  writeCommand(ST7789_SWRESET);
  delay(150);

  writeCommand(ST7789_SLPOUT);
  delay(120);

  writeCommand(ST7789_COLMOD);
  writeData(0x55); // 16-bit RGB565
  delay(10);

  writeCommand(ST7789_PORCTRL);
  {
    const uint8_t p[] = {0x0C, 0x0C, 0x00, 0x33, 0x33};
    writeDataBytes(p, sizeof(p));
  }

  writeCommand(ST7789_GCTRL);
  writeData(0x35);

  writeCommand(ST7789_VCOMS);
  writeData(0x19);

  writeCommand(ST7789_LCMCTRL);
  writeData(0x2C);

  writeCommand(ST7789_VDVVRHEN);
  writeData(0x01);

  writeCommand(ST7789_VRHS);
  writeData(0x12);

  writeCommand(ST7789_VDVS);
  writeData(0x20);

  writeCommand(ST7789_FRCTRL2);
  writeData(0x0F);

  writeCommand(ST7789_PWCTRL1);
  {
    const uint8_t p[] = {0xA4, 0xA1};
    writeDataBytes(p, sizeof(p));
  }

  writeCommand(ST7789_PVGAMCTRL);
  {
    const uint8_t p[] = {
      0xD0,0x04,0x0D,0x11,0x13,0x2B,0x3F,
      0x54,0x4C,0x18,0x0D,0x0B,0x1F,0x23
    };
    writeDataBytes(p, sizeof(p));
  }

  writeCommand(ST7789_NVGAMCTRL);
  {
    const uint8_t p[] = {
      0xD0,0x04,0x0C,0x11,0x13,0x2C,0x3F,
      0x44,0x51,0x2F,0x1F,0x1F,0x20,0x23
    };
    writeDataBytes(p, sizeof(p));
  }

  writeCommand(ST7789_INVON);
  delay(10);

  writeCommand(ST7789_NORON);
  delay(10);

  writeCommand(ST7789_DISPON);
  delay(120);
}

void ST7789_ESP32::begin(uint16_t w, uint16_t h, bool useHwSPI, uint32_t freq) {
  _panelW = w;
  _panelH = h;
  _useHwSPI = useHwSPI;
  _spiFreq = freq;
  _initialized = false;

  if (_panelW == 0 || _panelH == 0) return;

  // GFX dimensions are changed by setRotation().
  _width = _panelW;
  _height = _panelH;

  if (_blk >= 0) {
    pinMode(_blk, OUTPUT);
    digitalWrite(_blk, HIGH);
  }

  pinMode(_dc, OUTPUT);
  digitalWrite(_dc, HIGH);

  if (_cs >= 0) {
    pinMode(_cs, OUTPUT);
    digitalWrite(_cs, HIGH);
  }

  if (_useHwSPI) {
    _spi = &SPI;
    _spi->begin(_sclk, -1, _mosi, (_cs >= 0) ? _cs : -1);
    _spiSettings = SPISettings(_spiFreq, MSBFIRST, SPI_MODE0);
  } else {
    pinMode(_sclk, OUTPUT);
    pinMode(_mosi, OUTPUT);
    digitalWrite(_sclk, LOW);
    digitalWrite(_mosi, LOW);
  }

  resetDisplay();
  initSequence();

  // Common offsets:
  // 240x240: 0,0
  // 240x320: 0,0 for the native panel geometry; users can adjust manually.
  _colstart = _customColOffset;
  _rowstart = _customRowOffset;

  setRotation(0);
  fillScreen(COLOR_BLACK);
  _initialized = true;
}

void ST7789_ESP32::init(uint16_t w, uint16_t h) {
  begin(w, h, true, 40000000UL);
}

void ST7789_ESP32::setRotation(uint8_t m) {
  rotation = m & 3;

  uint8_t madctl;
  if (_panelW == 240 && _panelH == 240) {
    switch (rotation) {
      case 0: madctl = ST7789_MADCTL_MX | ST7789_MADCTL_MY; break;
      case 1: madctl = ST7789_MADCTL_MY | ST7789_MADCTL_MV; break;
      case 2: madctl = 0; break;
      default: madctl = ST7789_MADCTL_MX | ST7789_MADCTL_MV; break;
    }
  } else {
    switch (rotation) {
      case 0: madctl = ST7789_MADCTL_MX | ST7789_MADCTL_MY; break;
      case 1: madctl = ST7789_MADCTL_MY | ST7789_MADCTL_MV; break;
      case 2: madctl = 0; break;
      default: madctl = ST7789_MADCTL_MX | ST7789_MADCTL_MV; break;
    }
  }

  writeCommand(ST7789_MADCTL);
  writeData(madctl);

  if (rotation & 1) {
    _width = _panelH;
    _height = _panelW;
  } else {
    _width = _panelW;
    _height = _panelH;
  }

  // Most 240x240 IPS modules are a true 240x240 address space.
  // 240x320 modules commonly need a 0,0 origin in their native mode.
  _colstart = _customColOffset;
  _rowstart = _customRowOffset;
}

void ST7789_ESP32::setOffsets(int16_t colOffset, int16_t rowOffset) {
  _customColOffset = colOffset;
  _customRowOffset = rowOffset;
  setRotation(rotation);
}

void ST7789_ESP32::invertDisplay(bool invert) {
  writeCommand(invert ? ST7789_INVON : ST7789_INVOFF);
}

void ST7789_ESP32::setBacklight(bool on) {
  if (_blk >= 0) digitalWrite(_blk, on ? HIGH : LOW);
}

void ST7789_ESP32::setBacklightBrightness(uint8_t brightness) {
  if (_blk < 0) return;
#if defined(ARDUINO_ARCH_ESP32)
  analogWrite(_blk, brightness);
#else
  digitalWrite(_blk, brightness ? HIGH : LOW);
#endif
}

void ST7789_ESP32::sleepDisplay(bool sleep) {
  writeCommand(sleep ? ST7789_SLPIN : ST7789_SLPOUT);
  delay(sleep ? 120 : 120);
  if (!sleep) {
    writeCommand(ST7789_DISPON);
    delay(20);
  }
}

void ST7789_ESP32::setAddrWindowRaw(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
  uint16_t xs = x0 + _colstart;
  uint16_t xe = x1 + _colstart;
  uint16_t ys = y0 + _rowstart;
  uint16_t ye = y1 + _rowstart;

  beginWrite();
  digitalWrite(_dc, LOW);
  spiWriteByte(ST7789_CASET);
  digitalWrite(_dc, HIGH);
  spiWriteByte(xs >> 8); spiWriteByte(xs & 0xFF);
  spiWriteByte(xe >> 8); spiWriteByte(xe & 0xFF);
  digitalWrite(_dc, LOW);
  spiWriteByte(ST7789_RASET);
  digitalWrite(_dc, HIGH);
  spiWriteByte(ys >> 8); spiWriteByte(ys & 0xFF);
  spiWriteByte(ye >> 8); spiWriteByte(ye & 0xFF);
  digitalWrite(_dc, LOW);
  spiWriteByte(ST7789_RAMWR);
  digitalWrite(_dc, HIGH);
  // Transaction intentionally remains open; caller must write pixels and close.
}

void ST7789_ESP32::setAddrWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
  // Public helper: sends the address window and closes the SPI transaction.
  // Use drawing primitives for pixel data.
  setAddrWindowRaw(x0, y0, x1, y1);
  endWrite();
}

void ST7789_ESP32::drawPixel(int16_t x, int16_t y, uint16_t color) {
  if ((x < 0) || (y < 0) || (x >= width()) || (y >= height())) return;
  setAddrWindowRaw(x, y, x, y);
  spiWriteByte(color >> 8);
  spiWriteByte(color & 0xFF);
  endWrite();
}

void ST7789_ESP32::drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
  if (y < 0 || y >= height() || w <= 0) return;
  if (x < 0) { w += x; x = 0; }
  if (x + w > width()) w = width() - x;
  if (w <= 0) return;
  setAddrWindowRaw(x, y, x + w - 1, y);
  writeColor(color, (uint32_t)w);
  // writeColor closes the transaction, so do not call endWrite here.
}

void ST7789_ESP32::drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
  if (x < 0 || x >= width() || h <= 0) return;
  if (y < 0) { h += y; y = 0; }
  if (y + h > height()) h = height() - y;
  if (h <= 0) return;
  setAddrWindowRaw(x, y, x, y + h - 1);
  writeColor(color, (uint32_t)h);
}

void ST7789_ESP32::fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  if (w <= 0 || h <= 0) return;
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > width()) w = width() - x;
  if (y + h > height()) h = height() - y;
  if (w <= 0 || h <= 0) return;

  setAddrWindowRaw(x, y, x + w - 1, y + h - 1);
  writeColor(color, (uint32_t)w * (uint32_t)h);
}
