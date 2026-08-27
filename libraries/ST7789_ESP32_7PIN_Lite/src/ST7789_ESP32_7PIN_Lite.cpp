#include "ST7789_ESP32_7PIN_Lite.h"

static const uint8_t font5x7[] PROGMEM = {
  0x00,0x00,0x00,0x00,0x00, 0x00,0x00,0x5F,0x00,0x00, 0x00,0x07,0x00,0x07,0x00, 0x14,0x7F,0x14,0x7F,0x14,
  0x24,0x2A,0x7F,0x2A,0x12, 0x23,0x13,0x08,0x64,0x62, 0x36,0x49,0x55,0x22,0x50, 0x00,0x05,0x03,0x00,0x00,
  0x00,0x1C,0x22,0x41,0x00, 0x00,0x41,0x22,0x1C,0x00, 0x08,0x2A,0x1C,0x2A,0x08, 0x08,0x08,0x3E,0x08,0x08,
  0x00,0x50,0x30,0x00,0x00, 0x08,0x08,0x08,0x08,0x08, 0x00,0x60,0x60,0x00,0x00, 0x20,0x10,0x08,0x04,0x02,
  0x3E,0x51,0x49,0x45,0x3E, 0x00,0x42,0x7F,0x40,0x00, 0x42,0x61,0x51,0x49,0x46, 0x21,0x41,0x45,0x4B,0x31,
  0x18,0x14,0x12,0x7F,0x10, 0x27,0x45,0x45,0x45,0x39, 0x3C,0x4A,0x49,0x49,0x30, 0x01,0x71,0x09,0x05,0x03,
  0x36,0x49,0x49,0x49,0x36, 0x06,0x49,0x49,0x29,0x1E, 0x00,0x36,0x36,0x00,0x00, 0x00,0x56,0x36,0x00,0x00,
  0x00,0x08,0x14,0x22,0x41, 0x14,0x14,0x14,0x14,0x14, 0x41,0x22,0x14,0x08,0x00, 0x02,0x01,0x51,0x09,0x06,
  0x32,0x49,0x79,0x41,0x3E, 0x7E,0x11,0x11,0x11,0x7E, 0x7F,0x49,0x49,0x49,0x36, 0x3E,0x41,0x41,0x41,0x22,
  0x7F,0x41,0x41,0x22,0x1C, 0x7F,0x49,0x49,0x49,0x41, 0x7F,0x09,0x09,0x01,0x01, 0x3E,0x41,0x41,0x51,0x32,
  0x7F,0x08,0x08,0x08,0x7F, 0x00,0x41,0x7F,0x41,0x00, 0x20,0x40,0x41,0x3F,0x01, 0x7F,0x08,0x14,0x22,0x41,
  0x7F,0x40,0x40,0x40,0x40, 0x7F,0x02,0x04,0x02,0x7F, 0x7F,0x04,0x08,0x10,0x7F, 0x3E,0x41,0x41,0x41,0x3E,
  0x7F,0x09,0x09,0x09,0x06, 0x3E,0x41,0x51,0x21,0x5E, 0x7F,0x09,0x19,0x29,0x46, 0x46,0x49,0x49,0x49,0x31,
  0x01,0x01,0x7F,0x01,0x01, 0x3F,0x40,0x40,0x40,0x3F, 0x1F,0x20,0x40,0x20,0x1F, 0x7F,0x20,0x18,0x20,0x7F,
  0x63,0x14,0x08,0x14,0x63, 0x03,0x04,0x78,0x04,0x03, 0x61,0x51,0x49,0x45,0x43, 0x00,0x7F,0x41,0x41,0x00,
  0x02,0x04,0x08,0x10,0x20, 0x00,0x41,0x41,0x7F,0x00, 0x04,0x02,0x01,0x02,0x04, 0x40,0x40,0x40,0x40,0x40,
  0x00,0x01,0x02,0x04,0x00, 0x20,0x54,0x54,0x54,0x78, 0x7F,0x48,0x44,0x44,0x38, 0x38,0x44,0x44,0x44,0x20,
  0x38,0x44,0x44,0x48,0x7F, 0x38,0x54,0x54,0x54,0x18, 0x08,0x7E,0x09,0x01,0x02, 0x08,0x14,0x54,0x54,0x3C,
  0x7F,0x08,0x04,0x04,0x78, 0x00,0x44,0x7D,0x40,0x00, 0x20,0x40,0x44,0x3D,0x00, 0x7F,0x10,0x28,0x44,0x00,
  0x00,0x41,0x7F,0x40,0x00, 0x7C,0x04,0x18,0x04,0x78, 0x7C,0x08,0x04,0x04,0x78, 0x38,0x44,0x44,0x44,0x38,
  0x7C,0x14,0x14,0x14,0x08, 0x08,0x14,0x14,0x18,0x7C, 0x7C,0x08,0x04,0x04,0x08, 0x48,0x54,0x54,0x54,0x20,
  0x04,0x3F,0x44,0x40,0x20, 0x3C,0x40,0x40,0x20,0x7C, 0x1C,0x20,0x40,0x20,0x1C, 0x3C,0x40,0x30,0x40,0x3C,
  0x44,0x28,0x10,0x28,0x44, 0x0C,0x50,0x50,0x50,0x3C, 0x44,0x64,0x54,0x4C,0x44, 0x00,0x08,0x36,0x41,0x00,
  0x00,0x00,0x7F,0x00,0x00, 0x00,0x41,0x36,0x08,0x00, 0x08,0x08,0x2A,0x1C,0x08
};

ST7789_ESP32_7PIN_Lite::ST7789_ESP32_7PIN_Lite(int8_t sclk, int8_t mosi, int8_t dc, int8_t rst, int8_t cs, int8_t blk)
: _sclk(sclk), _mosi(mosi), _dc(dc), _rst(rst), _cs(cs), _blk(blk),
  _width(240), _height(240), _rotation(0), _xOffset(0), _yOffset(0),
  _cursorX(0), _cursorY(0), _textColor(ST77XX_WHITE), _textBg(ST77XX_BLACK),
  _textSize(1), _wrap(true), _hardwareSPI(true), _spiFrequency(20000000UL), _spi(nullptr) {}

void ST7789_ESP32_7PIN_Lite::bitBangByte(uint8_t data) {
  for (uint8_t i = 0; i < 8; ++i) {
    digitalWrite(_sclk, LOW);
    digitalWrite(_mosi, (data & 0x80) ? HIGH : LOW);
    digitalWrite(_sclk, HIGH);
    data <<= 1;
  }
}

void ST7789_ESP32_7PIN_Lite::writeCommand(uint8_t command) {
  digitalWrite(_dc, LOW);
  if (_cs >= 0) digitalWrite(_cs, LOW);
  if (_hardwareSPI && _spi) {
    _spi->beginTransaction(_spiSettings);
    _spi->transfer(command);
    _spi->endTransaction();
  } else bitBangByte(command);
  if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32_7PIN_Lite::writeData(uint8_t data) {
  digitalWrite(_dc, HIGH);
  if (_cs >= 0) digitalWrite(_cs, LOW);
  if (_hardwareSPI && _spi) {
    _spi->beginTransaction(_spiSettings);
    _spi->transfer(data);
    _spi->endTransaction();
  } else bitBangByte(data);
  if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32_7PIN_Lite::writeDataBuffer(const uint8_t *data, size_t len) {
  if (!len) return;
  digitalWrite(_dc, HIGH);
  if (_cs >= 0) digitalWrite(_cs, LOW);
  if (_hardwareSPI && _spi) {
    _spi->beginTransaction(_spiSettings);
    _spi->transferBytes((uint8_t*)data, nullptr, len);
    _spi->endTransaction();
  } else for (size_t i = 0; i < len; ++i) bitBangByte(data[i]);
  if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32_7PIN_Lite::writeColor(uint16_t color, uint32_t pixels) {
  if (!pixels) return;
  const uint8_t hi = color >> 8, lo = color & 0xFF;
  uint8_t buf[128];
  for (uint8_t i = 0; i < 64; ++i) { buf[i * 2] = hi; buf[i * 2 + 1] = lo; }

  digitalWrite(_dc, HIGH);
  if (_cs >= 0) digitalWrite(_cs, LOW);
  if (_hardwareSPI && _spi) {
    _spi->beginTransaction(_spiSettings);
    while (pixels) {
      uint32_t batch = pixels > 64 ? 64 : pixels;
      _spi->transferBytes(buf, nullptr, batch * 2);
      pixels -= batch;
    }
    _spi->endTransaction();
  } else {
    while (pixels--) { bitBangByte(hi); bitBangByte(lo); }
  }
  if (_cs >= 0) digitalWrite(_cs, HIGH);
}

void ST7789_ESP32_7PIN_Lite::hardwareReset() {
  if (_rst < 0) { delay(20); return; }
  pinMode(_rst, OUTPUT);
  digitalWrite(_rst, HIGH); delay(20);
  digitalWrite(_rst, LOW); delay(120);
  digitalWrite(_rst, HIGH); delay(120);
}

void ST7789_ESP32_7PIN_Lite::begin(uint16_t width, uint16_t height, bool hardwareSPI, uint32_t frequency) {
  _width = width; _height = height; _hardwareSPI = hardwareSPI; _spiFrequency = frequency;
  if (_blk >= 0) { pinMode(_blk, OUTPUT); digitalWrite(_blk, HIGH); }
  pinMode(_dc, OUTPUT); digitalWrite(_dc, HIGH);
  if (_cs >= 0) { pinMode(_cs, OUTPUT); digitalWrite(_cs, HIGH); }

  if (_hardwareSPI) {
    _spi = &SPI;
    #if defined(ESP32)
      _spi->begin(_sclk, -1, _mosi, (_cs >= 0) ? _cs : -1);
    #else
      _spi->begin();
    #endif
    _spiSettings = SPISettings(_spiFrequency, MSBFIRST, SPI_MODE0);
  } else {
    _spi = nullptr;
    pinMode(_sclk, OUTPUT); pinMode(_mosi, OUTPUT);
    digitalWrite(_sclk, LOW); digitalWrite(_mosi, LOW);
  }

  hardwareReset();

  writeCommand(ST7789_SWRESET); delay(150);
  writeCommand(ST7789_SLPOUT);  delay(120);
  writeCommand(ST7789_COLMOD);  writeData(0x55); delay(10);
  writeCommand(ST7789_PORCTRL); writeData(0x0C); writeData(0x0C); writeData(0x00); writeData(0x33); writeData(0x33);
  writeCommand(ST7789_GCTRL);   writeData(0x35);
  writeCommand(ST7789_VCOMS);   writeData(0x19);
  writeCommand(ST7789_LCMCTRL); writeData(0x2C);
  writeCommand(ST7789_VDVVRHEN);writeData(0x01);
  writeCommand(ST7789_VRHS);    writeData(0x12);
  writeCommand(ST7789_VDVS);    writeData(0x20);
  writeCommand(ST7789_FRCTRL2); writeData(0x0F);
  writeCommand(ST7789_PWCTRL1); writeData(0xA4); writeData(0xA1);
  writeCommand(ST7789_PVGAMCTRL);
  const uint8_t pg[] = {0xD0,0x04,0x0D,0x11,0x13,0x2B,0x3F,0x54,0x4C,0x18,0x0D,0x0B,0x1F,0x23};
  writeDataBuffer(pg, sizeof(pg));
  writeCommand(ST7789_NVGAMCTRL);
  const uint8_t ng[] = {0xD0,0x04,0x0C,0x11,0x13,0x2C,0x3F,0x44,0x51,0x2F,0x1F,0x1F,0x20,0x23};
  writeDataBuffer(ng, sizeof(ng));
  writeCommand(ST7789_INVON); delay(10);
  setRotation(0);
  writeCommand(ST7789_NORON); delay(10);
  writeCommand(ST7789_DISPON); delay(120);
  fillScreen(ST77XX_BLACK);
}

void ST7789_ESP32_7PIN_Lite::setRotation(uint8_t rotation) {
  _rotation = rotation & 3;
  static const uint8_t madctl[] = {0x08, 0x68, 0xC8, 0xA8};
  writeCommand(ST7789_MADCTL); writeData(madctl[_rotation]);
  _width = 240; _height = 240;
}

void ST7789_ESP32_7PIN_Lite::invertDisplay(bool invert) { writeCommand(invert ? ST7789_INVON : ST7789_INVOFF); }
void ST7789_ESP32_7PIN_Lite::setBacklight(bool on) { if (_blk >= 0) digitalWrite(_blk, on ? HIGH : LOW); }
void ST7789_ESP32_7PIN_Lite::setBacklightBrightness(uint8_t brightness) { if (_blk >= 0) analogWrite(_blk, brightness); }
void ST7789_ESP32_7PIN_Lite::sleepDisplay(bool sleep) { writeCommand(sleep ? 0x10 : ST7789_SLPOUT); delay(120); }
void ST7789_ESP32_7PIN_Lite::setOffsets(int16_t x, int16_t y) { _xOffset = x; _yOffset = y; }

void ST7789_ESP32_7PIN_Lite::setAddrWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
  x0 += _xOffset; x1 += _xOffset; y0 += _yOffset; y1 += _yOffset;
  writeCommand(ST7789_CASET); writeData(x0 >> 8); writeData(x0); writeData(x1 >> 8); writeData(x1);
  writeCommand(ST7789_RASET); writeData(y0 >> 8); writeData(y0); writeData(y1 >> 8); writeData(y1);
  writeCommand(ST7789_RAMWR);
}

void ST7789_ESP32_7PIN_Lite::fillScreen(uint16_t color) { fillRect(0, 0, _width, _height, color); }

void ST7789_ESP32_7PIN_Lite::drawPixel(int16_t x, int16_t y, uint16_t color) {
  if (x < 0 || y < 0 || x >= _width || y >= _height) return;
  setAddrWindow(x,y,x,y); writeColor(color,1);
}

void ST7789_ESP32_7PIN_Lite::drawFastHLine(int16_t x,int16_t y,int16_t w,uint16_t color) {
  if (y < 0 || y >= _height || w <= 0 || x >= _width) return;
  if (x < 0) { w += x; x = 0; }
  if (x + w > _width) w = _width - x;
  if (w <= 0) return;
  setAddrWindow(x,y,x+w-1,y); writeColor(color,w);
}

void ST7789_ESP32_7PIN_Lite::drawFastVLine(int16_t x,int16_t y,int16_t h,uint16_t color) {
  if (x < 0 || x >= _width || h <= 0 || y >= _height) return;
  if (y < 0) { h += y; y = 0; }
  if (y + h > _height) h = _height - y;
  if (h <= 0) return;
  setAddrWindow(x,y,x,y+h-1); writeColor(color,h);
}

void ST7789_ESP32_7PIN_Lite::drawLine(int16_t x0,int16_t y0,int16_t x1,int16_t y1,uint16_t color) {
  int16_t dx = abs(x1-x0), sx = x0<x1 ? 1:-1;
  int16_t dy = -abs(y1-y0), sy = y0<y1 ? 1:-1, err = dx+dy;
  for (;;) { drawPixel(x0,y0,color); if (x0==x1 && y0==y1) break; int16_t e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
}

void ST7789_ESP32_7PIN_Lite::drawRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color) {
  if(w<=0||h<=0)return; drawFastHLine(x,y,w,color); drawFastHLine(x,y+h-1,w,color); drawFastVLine(x,y,h,color); drawFastVLine(x+w-1,y,h,color);
}

void ST7789_ESP32_7PIN_Lite::fillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color) {
  if(x>=_width||y>=_height||w<=0||h<=0)return;
  if(x<0){w+=x;x=0;} if(y<0){h+=y;y=0;} if(x+w>_width)w=_width-x; if(y+h>_height)h=_height-y;
  if(w<=0||h<=0)return; setAddrWindow(x,y,x+w-1,y+h-1); writeColor(color,(uint32_t)w*h);
}

void ST7789_ESP32_7PIN_Lite::drawCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, uint16_t color) {
  int16_t f = 1 - r, ddF_x = 1, ddF_y = -2 * r, x = 0, y = r;
  while (x < y) {
    if (f >= 0) { y--; ddF_y += 2; f += ddF_y; }
    x++; ddF_x += 2; f += ddF_x;
    if (cornername & 0x4) { drawPixel(x0 + x, y0 + y, color); drawPixel(x0 + y, y0 + x, color); }
    if (cornername & 0x2) { drawPixel(x0 + x, y0 - y, color); drawPixel(x0 + y, y0 - x, color); }
    if (cornername & 0x8) { drawPixel(x0 - y, y0 + x, color); drawPixel(x0 - x, y0 + y, color); }
    if (cornername & 0x1) { drawPixel(x0 - y, y0 - x, color); drawPixel(x0 - x, y0 - y, color); }
  }
}

void ST7789_ESP32_7PIN_Lite::fillCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t cornername, int16_t delta, uint16_t color) {
  int16_t f = 1 - r, ddF_x = 1, ddF_y = -2 * r, x = 0, y = r;
  while (x < y) {
    if (f >= 0) { y--; ddF_y += 2; f += ddF_y; }
    x++; ddF_x += 2; f += ddF_x;
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

void ST7789_ESP32_7PIN_Lite::drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
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

void ST7789_ESP32_7PIN_Lite::fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
  int16_t max_r = ((w < h) ? w : h) / 2;
  if (r > max_r) r = max_r;
  fillRect(x + r, y, w - 2 * r, h, color);
  fillCircleHelper(x + w - r - 1, y + r, r, 1, h - 2 * r - 1, color);
  fillCircleHelper(x + r, y + r, r, 2, h - 2 * r - 1, color);
}

void ST7789_ESP32_7PIN_Lite::drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
  int16_t f = 1 - r, ddF_x = 1, ddF_y = -2 * r, x = 0, y = r;
  drawPixel(x0, y0 + r, color);
  drawPixel(x0, y0 - r, color);
  drawPixel(x0 + r, y0, color);
  drawPixel(x0 - r, y0, color);
  while (x < y) {
    if (f >= 0) { y--; ddF_y += 2; f += ddF_y; }
    x++; ddF_x += 2; f += ddF_x;
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

void ST7789_ESP32_7PIN_Lite::fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
  drawFastVLine(x0, y0 - r, 2 * r + 1, color);
  fillCircleHelper(x0, y0, r, 3, 0, color);
}

void ST7789_ESP32_7PIN_Lite::setCursor(int16_t x,int16_t y){_cursorX=x;_cursorY=y;}
void ST7789_ESP32_7PIN_Lite::setTextColor(uint16_t color){_textColor=color;_textBg=color;}
void ST7789_ESP32_7PIN_Lite::setTextColor(uint16_t color,uint16_t bg){_textColor=color;_textBg=bg;}
void ST7789_ESP32_7PIN_Lite::setTextSize(uint8_t size){_textSize=size?size:1;}
void ST7789_ESP32_7PIN_Lite::setTextWrap(bool wrap){_wrap=wrap;}

void ST7789_ESP32_7PIN_Lite::drawChar(int16_t x,int16_t y,unsigned char c,uint16_t color,uint16_t bg,uint8_t size){
  if(c<32||c>127)c=' ';
  uint16_t off=(c-32)*5;
  for(uint8_t i=0;i<5;i++){
    uint8_t line=pgm_read_byte(&font5x7[off+i]);
    for(uint8_t j=0;j<8;j++,line>>=1){
      if(line&1){ if(size==1)drawPixel(x+i,y+j,color); else fillRect(x+i*size,y+j*size,size,size,color); }
      else if(bg!=color){ if(size==1)drawPixel(x+i,y+j,bg); else fillRect(x+i*size,y+j*size,size,size,bg); }
    }
  }
  if(bg!=color){ if(size==1)drawFastVLine(x+5,y,8,bg); else fillRect(x+5*size,y,size,8*size,bg); }
}

size_t ST7789_ESP32_7PIN_Lite::write(uint8_t c){
  if(c=='\n'){_cursorX=0;_cursorY+=8*_textSize;}
  else if(c!='\r'){
    if(_wrap && _cursorX+6*_textSize>_width){_cursorX=0;_cursorY+=8*_textSize;}
    drawChar(_cursorX,_cursorY,c,_textColor,_textBg,_textSize); _cursorX+=6*_textSize;
  }
  return 1;
}

void ST7789_ESP32_7PIN_Lite::getTextBounds(const char* str,int16_t x,int16_t y,int16_t*x1,int16_t*y1,uint16_t*w,uint16_t*h){
  if(x1)*x1=x; if(y1)*y1=y; if(!str){if(w)*w=0;if(h)*h=0;return;}
  if(w)*w=strlen(str)*6*_textSize; if(h)*h=8*_textSize;
}
