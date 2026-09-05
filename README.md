# Web Hidroponik

Starter full-stack sederhana untuk memasukkan desain frontend dan mengembangkan backend API.

## Menjalankan

Pastikan Node.js 18 atau lebih baru sudah terpasang, lalu jalankan:

```bash
npm start
```

Buka http://localhost:3000. Untuk mode development dengan restart otomatis:

```bash
npm run dev
```

## Struktur

- `public/index.html`: struktur halaman dan konten.
- `public/styles.css`: seluruh gaya visual, siap diganti dengan desainmu.
- `public/app.js`: interaksi frontend dan pemanggilan API.
- `server.js`: server static dan endpoint backend.
- `GET /api/health`: pengecekan status API.
- `POST /api/contact`: contoh endpoint formulir.

## Mengembangkan backend

Tambahkan route di `server.js`, lalu ganti bagian contoh penyimpanan di endpoint contact dengan database atau service yang kamu gunakan. File statis, gambar, dan font lokal bisa ditambahkan di dalam folder `public`.
