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

## Ketentuan tanaman dengan Gemini

Panel `Ketentuan Tanaman` memakai Gemini untuk membuat rentang pH, nutrisi,
dan suhu berdasarkan tanaman yang dipilih. Simpan API key hanya di environment
server:

```powershell
$env:GEMINI_API_KEY = "isi-api-key-gemini-anda"
$env:GEMINI_MODEL = "gemini-2.5-flash"
npm start
```

Endpoint `POST /api/plant-guidance` menerima body JSON seperti
`{"plant":"Selada"}`. Tanpa `GEMINI_API_KEY`, panel akan menampilkan pesan
konfigurasi dan server tetap berjalan.

### Backend gratis dengan Google Apps Script

Gunakan file `apps-script/Code.gs` jika tidak ingin memakai Firebase Functions:

1. Buka https://script.google.com dan buat project baru.
2. Salin isi `apps-script/Code.gs` ke editor Apps Script.
3. Buka **Project Settings > Script Properties**, lalu tambahkan property `GEMINI_API_KEY` berisi API key Gemini.
4. Klik **Deploy > New deployment > Web app**.
5. Pilih **Execute as: Me** dan **Who has access: Anyone**, lalu deploy.
6. Salin URL Web App ke `PLANT_GUIDANCE_API_URL` di `public/hydrowatch.js`.
7. Deploy ulang Hosting dengan `npx firebase-tools deploy --only hosting`.

Backend ini hanya memanggil Gemini dan tidak menyimpan rekomendasi ke database.

## Mengembangkan backend

Tambahkan route di `server.js`, lalu ganti bagian contoh penyimpanan di endpoint contact dengan database atau service yang kamu gunakan. File statis, gambar, dan font lokal bisa ditambahkan di dalam folder `public`.
