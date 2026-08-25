# 🚗 Vehicle Monitoring & Maintenance System (Automotive SCADA Dashboard)

Sistem Dashboard Telemetri Kendaraan dan Manajemen Pemeliharaan Prediktif (*Predictive Maintenance*) modern bertema **Automotive SCADA / Digital Cockpit HUD**. Dibangun murni menggunakan **HTML5, CSS3, dan Vanilla JavaScript ES6+**, langsung siap dijalankan menggunakan **VS Code Live Server** tanpa perlu instalasi Node.js, npm, ataupun bundler.

---

## 📑 DAFTAR ISI
1. [Fitur Utama](#-fitur-utama)
2. [Struktur Folder](#-struktur-folder)
3. [Cara Membuka dengan Live Server](#-cara-membuka-dengan-live-server)
4. [Demo Mode & Pengujian Fitur](#-demo-mode--pengujian-fitur)
5. [Integrasi Firebase Realtime Database](#-integrasi-firebase-realtime-database)
6. [Struktur Database Firebase](#-struktur-database-firebase)
7. [Logika & Rumus Perhitungan Maintenance](#-logika--rumus-perhitungan-maintenance)
8. [Panduan Integrasi IoT ESP32 (Arduino C++)](#-panduan-integrasi-iot-esp32-arduino-c)
9. [Deploy ke GitHub Pages](#-deploy-ke-github-pages)

---

## ⚡ FITUR UTAMA

- **Technical SCADA Vehicle Blueprint (Inline SVG)**: Visualisasi samping mobil dengan 7 hotspot sensor interaktif (*Engine Oil, Transmission, Coolant, Air Filter, Brakes, Tires, 12V Battery*) yang berkedip sesuai status kesehatan komponen (*NORMAL / WARNING / DUE*).
- **Realtime Telemetry HUD**: Gauge tachometer semi-sirkular digital untuk kecepatan (*Speed KM/H*), Odometer (*ODO*), Trip meter, GPS coordinates, dan status koneksi ESP32.
- **Speed Limit Warning Alert**: Peringatan visual dan perubahan warna otomatis pada gauge saat kecepatan melebihi batas *Speed Limit* yang ditetapkan.
- **Dynamic Maintenance Engine**: 
  - Proyeksi *Next Service ODO* dan *Next Service Date* dihitung otomatis.
  - Perubahan interval waktu/jarak di *Settings* langsung memperbarui jadwal service yang akan datang.
  - Dual threshold logic (*Distance & Time remaining*).
- **Log Service & Parts Checklist**: Form pencatatan service kendaraan lengkap dengan multi-select spare parts yang diganti, catatan mekanik, dan upload bukti foto/invoice.
- **Service History Timeline**: Riwayat service tersusun rapi dari yang terbaru ke terlama dengan filter kategori.
- **Zero-Config Live Server Ready**: Langsung berjalan mulus dalam *DEMO MODE* jika Firebase belum dikonfigurasi.

---

## 📁 STRUKTUR FOLDER

```text
car-maintenance/
│
├── index.html                  # Halaman dashboard utama (Single Page SCADA)
│
├── css/
│   └── style.css               # Styling SCADA Dark Mode, Neon Glow, & Responsiveness
│
├── js/
│   ├── firebase-config.js      # Konfigurasi credentials Firebase
│   ├── firebase.js             # Abstraksi koneksi Firebase v10 CDN & Realtime Bus
│   ├── maintenance-engine.js   # Logika bisnis & kalkulasi interval dinamis
│   ├── demo-simulator.js       # Mesin simulasi telemetri mobil (Demo Mode)
│   └── app.js                  # Controller utama dashboard & UI orchestration
│
├── assets/
│   ├── icons/                  # Aset icon pendukung
│   └── images/                 # Aset grafis
│
├── .gitignore                  # Git ignore rules
└── README.md                   # Dokumentasi lengkap sistem
```

---

## 🚀 CARA MEMBUKA DENGAN LIVE SERVER

1. **Download & Extract ZIP** atau buka folder project ini di komputer Anda.
2. Buka folder `car maintenance` menggunakan **Visual Studio Code**.
3. Pastikan ekstensi **Live Server** (oleh *Ritwick Dey*) telah terpasang di VS Code.
4. Klik kanan pada file [`index.html`](file:///d:/project%20OIT%20dengan%20web%20dashboard/car%20maintenance/index.html) lalu pilih **"Open with Live Server"** (atau tekan shortcut `Alt + L, Alt + O`).
5. Browser akan otomatis terbuka di `http://127.0.0.1:5500/index.html`.
6. Dashboard langsung tampil dalam **DEMO MODE** dengan visualisasi kendaraan dan telemetri yang aktif.

---

## 🧪 DEMO MODE & PENGUJIAN FITUR

Dashboard ini dilengkapi dengan simulator telemetri otomatis agar Anda dapat mendemokan semua skenario tanpa memerlukan perangkat keras ESP32:

1. **Uji Speed Limit Alert**:
   - Di panel kanan bawah, klik tombol **"⚠ Speed > 60"** untuk menaikkan kecepatan ke 95 KM/H.
   - Perhatikan *Speed Gauge* berubah warna merah neon dan banner peringatan muncul di atas dashboard.
   - Klik **"✓ Cruise 55"** untuk menormalkan kembali.
2. **Uji Status Reminder WARNING & DUE**:
   - Klik **"⚡ Warning ODO"** (Odo diset ke 99,650 KM) untuk melihat status komponen mendekati jadwal service.
   - Klik **"✕ Due ODO"** (Odo diset ke 100,500 KM) untuk melihat status komponen yang terlambat service (*DUE*).
3. **Uji Catat Service Baru**:
   - Klik tombol besar **"CHECK MAINTENANCE SCHEDULE"**.
   - Klik tombol **"+ ADD SERVICE RECORD"**.
   - Isi form (contoh: Ganti Oli Mesin pada Odo 100,250 KM), pilih checklist, lalu simpan.
   - Sistem akan otomatis menghitung ulang *Next Service ODO* (`100,250 + 20,000 = 120,250 KM`) dan *Next Service Date* (`+ 2 Bulan`).

---

## 🔌 INTEGRASI FIREBASE REALTIME DATABASE

Jika Anda ingin menghubungkan dashboard ke Firebase Realtime Database asli:

1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru.
2. Buat database di menu **Build > Realtime Database**.
3. Masuk ke **Project Settings > General**, daftarkan Web App (`</>`), lalu salin objek `firebaseConfig`.
4. Buka file [`js/firebase-config.js`](file:///d:/project%20OIT%20dengan%20web%20dashboard/car%20maintenance/js/firebase-config.js) di editor Anda dan ganti nilai konfigurasinya:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyD-xxxxxxxxxxxxxx",
     authDomain: "proyek-anda.firebaseapp.com",
     databaseURL: "https://proyek-anda-default-rtdb.firebaseio.com",
     projectId: "proyek-anda",
     storageBucket: "proyek-anda.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```
5. Simpan file. Dashboard akan otomatis mendeteksi koneksi dan mengubah badge status di pojok kanan atas menjadi **`● FIREBASE CONNECTED`**.

---

## 🗄 STRUKTUR DATABASE FIREBASE

Struktur path Firebase Realtime Database yang digunakan:

```json
{
  "vehicle": {
    "current": {
      "speed": 72,
      "trip": 124.6,
      "odo": 97245,
      "latitude": -6.2088,
      "longitude": 106.8456,
      "gps": "CONNECTED",
      "esp32": "ONLINE",
      "date": "2026-08-25",
      "time": "21:32:15",
      "lastUpdate": "21:32:15"
    }
  },
  "settings": {
    "speedLimit": 60,
    "maintenance": {
      "oil_engine": {
        "name": "Engine Oil",
        "category": "engine",
        "intervalKm": 20000,
        "intervalMonths": 2,
        "reminderKm": 500,
        "reminderDays": 7
      },
      "oil_filter": {
        "name": "Oil Filter",
        "category": "engine",
        "intervalKm": 20000,
        "intervalMonths": 2,
        "reminderKm": 500,
        "reminderDays": 7
      },
      "air_filter": {
        "name": "Air Filter",
        "category": "engine",
        "intervalKm": 40000,
        "intervalMonths": 4,
        "reminderKm": 1000,
        "reminderDays": 14
      }
    }
  },
  "maintenance": {
    "oil_engine": {
      "lastServiceOdo": 80000,
      "lastServiceDate": "2026-06-25",
      "nextServiceOdo": 100000,
      "nextServiceDate": "2026-08-25",
      "status": "NORMAL"
    }
  },
  "history": {
    "srv_demo_01": {
      "type": "oil_engine",
      "typeName": "Engine Oil Service",
      "odo": 80000,
      "date": "2026-06-25",
      "notes": "Full synthetic 5W-30",
      "items": ["Engine Oil", "Oil Filter"]
    }
  }
}
```

---

## 🧮 LOGIKA & RUMUS PERHITUNGAN MAINTENANCE

Sistem menggunakan logika kalkulasi dinamis:

### 1. Perhitungan Jadwal Berikutnya
$$\text{Next Service Odo} = \text{Last Service Odo} + \text{Interval Km}$$
$$\text{Next Service Date} = \text{Last Service Date} + \text{Interval Months}$$

### 2. Penentuan Status Kesehatan
- **Status `DUE` (Overdue)**:
  $$\text{Current Odo} \ge \text{Next Service Odo} \quad \text{ATAU} \quad \text{Today} \ge \text{Next Service Date}$$
- **Status `WARNING` (Mendekati Jadwal)**:
  $$\text{Current Odo} \ge (\text{Next Service Odo} - \text{Reminder Km}) \quad \text{ATAU} \quad \text{Days Remaining} \le \text{Reminder Days}$$
- **Status `NORMAL`**:
  Semua kondisi di atas belum tercapai.

---

## 📡 PANDUAN INTEGRASI IOT ESP32 (ARDUINO C++)

Berikut adalah contoh sketch Arduino untuk ESP32 menggunakan library `Firebase-ESP-Client` untuk mengirim telemetri OBD-II / GPS ke Firebase:

```cpp
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"

#define API_KEY "AIzaSyD-xxxxxxxxxxxxxx"
#define DATABASE_URL "https://proyek-anda-default-rtdb.firebaseio.com"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.ready()) {
    // Membaca sensor kecepatan / OBD2 / GPS
    int speed = 72; // contoh pembacaan OBD2
    int odo = 97245;
    float trip = 124.6;

    FirebaseJson json;
    json.set("speed", speed);
    json.set("odo", odo);
    json.set("trip", trip);
    json.set("gps", "CONNECTED");
    json.set("esp32", "ONLINE");
    json.set("latitude", -6.2088);
    json.set("longitude", 106.8456);
    json.set("lastUpdate", "21:32:15");

    Firebase.RTDB.updateNode(&fbdo, "/vehicle/current", &json);
  }
  delay(1000); // Kirim data setiap 1 detik
}
```

---

## 🌐 DEPLOY KE GITHUB PAGES

1. Upload seluruh isi folder project ini ke repository GitHub baru.
2. Buka **Settings** repository di GitHub.
3. Pilih menu **Pages** di sidebar kiri.
4. Pada bagian **Build and deployment > Source**, pilih **Deploy from a branch**.
5. Pilih branch `main` (atau `master`) dan folder `/ (root)`, lalu klik **Save**.
6. Website akan langsung aktif dan dapat diakses publik dengan dukungan HTTPS gratis!

---

*Dikembangkan untuk sistem monitoring kendaraan pribadi pintar & aman.*
