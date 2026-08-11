# Gamato Piranti

**Suite alat digital modern — cepat, gratis, dan privasi terjaga.**

Gamato Piranti menghadirkan berbagai alat digital harian dalam satu tempat. Semua proses berjalan langsung di perangkat pengguna — tidak ada file yang diunggah ke server mana pun.

---

## ✨ Fitur

| Alat | Deskripsi |
|------|-----------|
| **QR & Barcode Studio** | QR code multi-template (URL, WiFi, email, telepon) dengan bentuk & warna full custom (bukan QR generik) plus logo tengah; barcode berbagai format dengan cetak massal langsung ke PDF rapi |
| **PDF Lab – Suite** | 9 mode: kompres, gabung, pecah, ekstrak, hapus halaman, putar, atur ulang, gambar→PDF, teks→PDF |
| **Doc Studio** | Editor dokumen dengan Find & Replace, template cepat, snapshot, ekspor .docx / .pdf / .txt |
| **Image Lab** | Kompres, resize, konversi format (JPG/PNG/WEBP), putar — batch processing |
| **Rak Utilitas** | Kalkulator serba-guna (standar, pajak, bunga, investasi, cicilan/hutang, rumus, HPP/COGS), Kamus Dunia (terjemahan puluhan bahasa), HTML Preview, Diagram & Rumus Studio (flowchart/struktur/chart + LaTeX), Pengukur Kekuatan Suara, JSON formatter, Base64, bulk teks/data, statistik, password & token generator, dan lainnya |
| **Video Studio** | Potong/cut video, crop & resize (rasio 1:1/9:16/16:9/dst), teks & subtitle (CC — ekspor .SRT/.VTT atau bakar ke video), gabung klip dengan transisi cut/crossfade, kecepatan & filter warna — semua ringan, native browser (video+canvas+MediaRecorder), tanpa upload ke server |
| **Spesial** | Kwitansi, Invoice, dan Struk/Nota profesional (logo custom, ekspor PNG & PDF, cetak langsung ke printer USB/Bluetooth), generator sertifikat & piagam massal full custom, WA link |

Mendukung mode terang & gelap yang mengikuti preferensi sistem atau bisa diatur manual, dan tersimpan otomatis untuk kunjungan berikutnya.

---

## 🔒 Privasi & Keamanan

- Semua pemrosesan file terjadi di browser pengguna (client-side), tidak ada file yang dikirim atau disimpan di server.
- Tidak ada akun, tidak ada pelacakan pihak ketiga, tidak ada iklan.
- Input pengguna disanitasi sebelum digunakan untuk mencegah penyalahgunaan (XSS, tautan berbahaya, dsb).
- Satu-satunya pengecualian: **Kamus Dunia** memanggil layanan terjemahan pihak ketiga (MyMemory) langsung dari browser karena kamus dunia offline penuh membutuhkan dataset raksasa — teks yang diterjemahkan tidak pernah singgah di server Gamato Piranti (karena memang tidak ada server pemrosesan).

## 🚀 Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

## 📦 Build untuk Produksi

```bash
npm run build
npm run preview
```

Proyek ini siap untuk di-deploy ke platform hosting statis modern (mis. Vercel) tanpa konfigurasi tambahan.

---

## 🤝 Kontribusi

Laporan bug dan saran fitur sangat diterima melalui Issues. Pastikan untuk tidak menyertakan data pribadi atau file sensitif pada laporan yang dibagikan.

---

© 2025 Gamato Piranti · Dikembangkan oleh **WisDev**
