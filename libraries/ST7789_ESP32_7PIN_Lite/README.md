# ST7789 ESP32 7PIN Lite — OLED-style 240x240

Lightweight custom ST7789 driver for ESP32/ESP32-C3 and common 7-pin 240x240 modules without CS.

## Design goals
- No Adafruit_GFX dependency.
- 5x7 built-in ASCII font.
- Hardware SPI with explicit **SPI MODE 0**.
- Custom SCLK/MOSI pins for ESP32-C3.
- Optional CS; use `-1` for 7-pin modules without CS.
- Optional BLK/backlight pin.
- Efficient bulk color writes using a small 128-byte buffer.
- Simple OLED-style API: text, pixels, lines, rectangles, fill.
- Fixed 240x240 rotation geometry; no incorrect 80-pixel offsets.

## ESP32-C3 example wiring
| TFT | ESP32-C3 |
|---|---:|
| VCC | 3.3V |
| GND | GND |
| SCL | GPIO 4 |
| SDA | GPIO 6 |
| RES | GPIO 7 |
| DC | GPIO 10 |
| BLK | 3.3V for testing, or GPIO 5 |

If the module has no CS pin, pass `-1` as CS.

## First test
Install the folder in Arduino `libraries`, restart Arduino IDE, then open:
`File > Examples > ST7789 ESP32 7PIN Lite > ST7789_Lite_Diagnostic`

The diagnostic intentionally uses 20 MHz first. Once stable, the project can use 40 MHz.

## Important
This library cannot compensate for incorrect wiring, incompatible panel hardware, missing power, or a defective display. ST7789 modules can differ in panel initialization and offsets; this package targets the common 240x240 configuration.
