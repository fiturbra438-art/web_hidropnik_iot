# Web Hidroponik

Starter full-stack sederhana untuk memasukkan desain frontend dan mengembangkan backend API.

## Menjalankan

Pastikan Node.js 18 atau lebih baru sudah terpasang, lalu jalankan:

```bash
npm start
```

Buka https://hidroponik-iot-69bf7.web.app/. Untuk mode development dengan restart otomatis:

```bash
npm run dev
```

## Struktur

- `public/index.html`: struktur halaman dan konten.
- `public/styles.css`: seluruh gaya visual, siap diganti dengan desainmu.
- `public/app.js`: interaksi frontend dan pemanggilan API.
- `server.js`: server static dan endpoint backend.
- `GET /api/health`: pengecekan status API.
- `GET /api/sensor/latest`: mengambil pembacaan sensor terbaru dari sumber data.
- `POST /api/contact`: contoh endpoint formulir.

## Sumber data sensor

Backend memakai `SENSOR_DATA_URL` untuk mengambil data sensor. Jika tidak diatur,
backend memakai Firebase Realtime Database yang sudah dikonfigurasi:

```text
https://hidroponik-iot-69bf7-default-rtdb.asia-southeast1.firebasedatabase.app/SensorReading.json
```

Untuk memakai URL hosting lain di PowerShell:

```powershell
$env:SENSOR_DATA_URL = "https://alamat-hosting-anda/data"
npm start
```

## Mengembangkan backend

Tambahkan route di `server.js`, lalu ganti bagian contoh penyimpanan di endpoint contact dengan database atau service yang kamu gunakan. File statis, gambar, dan font lokal bisa ditambahkan di dalam folder `public`.
