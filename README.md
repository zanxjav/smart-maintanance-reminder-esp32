# 🚗 Daihatsu Ayla / Agya Vehicle Monitoring & Smart Maintenance System (ESP32 IoT)

Dashboard telemetri kendaraan minimalis dan sistem *Predictive Maintenance* otomatis bertema **Modern Automotive SCADA** untuk kendaraan **Daihatsu Ayla / Toyota Agya**. Dibangun dengan **HTML5, CSS3, Vanilla JavaScript ES6+**, dan **Firebase Realtime Database**.

---

## ⚡ FITUR UTAMA

- **Siluet Vektor Daihatsu Ayla Hatchback**: Ilustrasi teknikal presisi tampak samping mobil Daihatsu Ayla lengkap dengan 7 hotspot sensor interaktif (*Engine Oil, Transmission, Radiator Coolant, Air Filter, Aki Battery, Brakes, dan Tires*) yang berkedip sesuai status kesehatan komponen (*NORMAL / WARNING / DUE*).
- **Speed Limiter Menu untuk ESP32**: Pengaturan batas kecepatan (*Speed Limit*) dengan slider, preset cepat (40, 60, 80, 100, 120 KM/H), dan sinkronisasi realtime ke Firebase RTDB (`settings/speedLimit`) untuk dibaca modul IoT ESP32.
- **Speedometer HUD & Over-Speed Alert**: Tampilan digital kecepatan realtime dengan busur tachometer dinamis dan peringatan visual saat melebihi batas kecepatan.
- **Trip Meter & Odometer**: Informasi jarak tempuh perjalanan (*Trip*) dengan tombol reset instan serta total Odometer kendaraan.
- **Automatic Maintenance Engine & Configurable Intervals**:
  - Proyeksi *Next Service ODO* (`Last ODO + Interval KM`) dan *Next Service Date* (`Last Date + Interval Bulan`) dihitung otomatis.
  - Interval dapat disesuaikan kapan saja pada menu *Setting Interval*.
  - Dual reminder logic (*Berdasarkan Jarak KM dan Waktu Hari tersisa*).
- **Service Logging & History**: Pencatatan riwayat service dengan checklist komponen yang diganti, catatan mekanik, dan bukti foto nota.
- **Zero-Config Live Server**: Langsung berjalan dengan mode simulasi (*Demo Mode*) tanpa perlu konfigurasi awal.

---

## 📁 STRUKTUR FOLDER

```text
car-maintenance/
│
├── index.html                  # Dashboard Utama Single Page (Minimalist SCADA Ayla)
├── css/
│   └── style.css               # Desain Minimalist Dark Automotive & Responsive
├── js/
│   ├── firebase-config.js      # Konfigurasi credentials Firebase
│   ├── firebase.js             # Service Firebase v10 CDN & Data Bus
│   ├── maintenance-engine.js   # Kalkulasi interval dinamis & evaluasi status
│   ├── demo-simulator.js       # Simulator telemetri realistis
│   └── app.js                  # Main controller, speed limiter modal & UI
├── assets/
│   ├── icons/
│   └── images/
├── .gitignore
└── README.md
```

---

## 🚀 CARA MEMBUKA DENGAN LIVE SERVER

1. Buka folder ini di **VS Code**.
2. Klik kanan pada file [`index.html`](file:///d:/project%20OIT%20dengan%20web%20dashboard/car%20maintenance/index.html) lalu pilih **"Open with Live Server"**.
3. Dashboard langsung terbuka di browser dengan simulasi kecepatan, trip, dan status maintenance.

---

## 📡 CONTOH KODE ESP32 (ARDUINO C++)

Berikut contoh script ESP32 untuk membaca speed limit dari Firebase dan mengirim telemetri:

```cpp
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI"
#define API_KEY "AIzaSyD-xxxxxx"
#define DATABASE_URL "https://proyek-anda-default-rtdb.firebaseio.com"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

int currentSpeedLimit = 60;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.ready()) {
    // 1. Baca setting speed limit yang diubah dari website
    if (Firebase.RTDB.getInt(&fbdo, "/settings/speedLimit")) {
      currentSpeedLimit = fbdo.intData();
    }

    // 2. Kirim telemetri (kecepatan, odo, trip, gps status)
    int speed = 72; // dari sensor OBD2 / Hall Effect
    float trip = 124.6;
    int odo = 97245;

    FirebaseJson json;
    json.set("speed", speed);
    json.set("odo", odo);
    json.set("trip", trip);
    json.set("esp32", "ONLINE");
    json.set("gps", "CONNECTED");
    json.set("lastUpdate", "14:30:00");

    Firebase.RTDB.updateNode(&fbdo, "/vehicle/current", &json);

    // 3. Buzzer alarm jika melebihi speed limit
    if (speed > currentSpeedLimit) {
      // Nyalakan alarm / buzzer di mobil
    }
  }
  delay(1000);
}
```
