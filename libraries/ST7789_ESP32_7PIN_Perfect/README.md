# ST7789_ESP32_7PIN v2.0.0

Custom ST7789 driver for ESP32/ESP32-C3, designed for common 7-pin 240x240 modules without CS.

## Wiring

ESP32-C3 SuperMini example:

- VCC -> 3.3V (verify your module's power requirements)
- GND -> GND
- SCL -> GPIO 4
- SDA -> GPIO 6
- RES -> GPIO 7
- DC -> GPIO 10
- BLK -> 3.3V directly for initial testing, or an appropriate GPIO for software control
- CS -> not connected for 7-pin modules without CS

## Main fixes versus the earlier custom driver

- SPI is explicitly **MODE0**, not MODE3.
- Uses Adafruit_GFX for the graphics/text engine instead of maintaining a second font/graphics implementation.
- Hardware SPI supports custom ESP32 pins.
- Software SPI uses proper mode-0 timing.
- CS is optional and remains HIGH when supplied.
- Address-window and pixel writes keep one SPI transaction for the whole operation.
- 240x240 panels use zero offset by default; custom offsets are supported.
- Backlight is independent from display data and can be controlled separately.
- Includes a diagnostic example that tests RED/GREEN/BLUE/WHITE before drawing text.

## Install

Copy the `ST7789_ESP32_7PIN` folder into your Arduino `libraries` directory, then restart Arduino IDE.

Install dependency: **Adafruit GFX Library**.

## First test

Open:

`File > Examples > ST7789_ESP32_7PIN > ST7789_Diagnostic`

For the first hardware test, connect BLK directly to 3.3V and test with only ESP32-C3 + TFT.

## Important

A display saying `INIT COMPLETE` on Serial does not prove that the panel is electrically receiving SPI data. If the diagnostic still remains black after this driver, check VCC/BLK voltage, GND, SCL/SDA, DC, RES, and the exact module pinout.
