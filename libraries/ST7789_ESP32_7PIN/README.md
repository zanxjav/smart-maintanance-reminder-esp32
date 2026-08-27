# ST7789_ESP32_7PIN Library

Custom standalone driver ST7789 240x240 IPS (Modul 7-Pin tanpa CS) untuk ESP32 / ESP32-C3 dengan **Zero External Dependencies** (tidak butuh Adafruit_GFX / Adafruit_BusIO).

## Fitur Utama
- **Kecepatan Tinggi**: Mendukung Hardware SPI hingga 40 MHz dengan ESP32 burst transfer.
- **Support 7-Pin Module**: Khusus dirancang untuk modul ST7789 tanpa CS pin (GND, VCC, SCL, SDA, RES, DC, BLK).
- **Mandiri (Zero Dependencies)**: Graphics engine (garis, kotak, lingkaran, round rect, segitiga, warna 16-bit RGB565) & font ASCII 5x7 sudah terintegrasi langsung.
- **Anti-Flicker**: Rendering teks dengan background otomatis tanpa kedip.

---

## Wiring Modul TFT ST7789 (7-Pin) ke ESP32-C3

| Pin Modul TFT | Sambungkan ke Pin ESP32-C3 | Keterangan |
| :--- | :--- | :--- |
| **GND** | **GND** | Ground |
| **VCC** | **3.3V** (atau 5V jika modul punya LDO) | Power Supply |
| **SCL (SCLK)** | **GPIO 4** | SPI Clock |
| **SDA (MOSI)** | **GPIO 6** | SPI Data |
| **RES (RST)** | **GPIO 7** | Hardware Reset |
| **DC (RS)** | **GPIO 10** | Data / Command |
| **BLK (LED)** | **3.3V** atau **GPIO 5** | Backlight Control (**WAJIB NYALA**) |

> **PENTING**: Layar TFT akan tampak hitam total jika pin **BLK** tidak diberi tegangan (3.3V) atau tidak diset HIGH!

---

## Cara Pasang di Arduino IDE

### Cara 1: Menggunakan File Sketch Langsung (Paling Mudah)
1. Buka folder `firmware/` di project ini.
2. Di dalam folder `firmware/` sudah ada `esp32_vehicle_monitor.ino`, `ST7789_ESP32.h`, dan `ST7789_ESP32.cpp`.
3. Buka `esp32_vehicle_monitor.ino` langsung di Arduino IDE dan klik **Upload**.

### Cara 2: Install sebagai Library .ZIP di Arduino IDE
1. Download file `ST7789_ESP32_7PIN.zip` dari repositori GitHub ini.
2. Buka **Arduino IDE** -> Menu **Sketch** -> **Include Library** -> **Add .ZIP Library...**
3. Pilih file `ST7789_ESP32_7PIN.zip`.
4. Buka contoh dari menu **File** -> **Examples** -> **ST7789_ESP32_7PIN** -> **ST7789_Diagnostic_Test** atau **Vehicle_Monitor**.
