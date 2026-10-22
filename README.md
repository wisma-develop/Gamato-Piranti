# Gamato Piranti

**Suite alat digital modern — cepat, gratis, dan privasi terjaga.**

Gamato Piranti menghadirkan berbagai alat digital harian dalam satu tempat. Semua proses berjalan langsung di perangkat pengguna — tidak ada file yang diunggah ke server mana pun.

---

## ✨ Fitur

| Alat | Deskripsi |
|------|-----------|
| **QR & Barcode Studio** | QR code multi-template (URL, WiFi, email, telepon) dengan bentuk & warna full custom (bukan QR generik) plus logo tengah; barcode berbagai format dengan cetak massal langsung ke PDF rapi; QR Code Scanner (unggah gambar atau kamera langsung) |
| **Cetak File & Dokumen** | Pratinjau + pengaturan setara dialog cetak: kertas, margin, skala, N-up, buklet, salinan, warna, header/footer, watermark; PDF/gambar/DOCX/XLSX/PPTX/teks |
| **Kompres Dokumen** | Satu alat untuk memperkecil PDF (gambar JPEG / mode agresif), DOCX/XLSX/PPTX/ODT/EPUB/ZIP (gambar di dalam dokumen + ZIP ulang), gambar, dan berkas teks; batch + ZIP; hasil tak pernah lebih besar dari asli |
| **Kompres Video** | Preset / kustom / target ukuran file, uji 5 detik |
| **Kompres Audio** | Opus (WebCodecs + muxer Ogg), preset, bitrate kustom, target ukuran, batch + ZIP |
| **Kolase Gambar** | 46 template + grid otomatis + mode bebas/scrapbook, bentuk sel, bingkai, bayangan, latar, teks & stiker; ekspor PNG/JPG/WEBP/PDF |
| **Edit Audio** | Editor waveform lengkap: pangkas/potong/tempel, fade, tempo & pitch, EQ, kompresor, limiter, echo, reverb, noise gate, marker; ekspor WAV/Opus/ZIP per marker |
| **Transkrip Audio** | Whisper di browser → transkrip berformat (waktu, pembicara, paragraf, ringkasan); ekspor DOCX/PDF/TXT/MD/SRT/VTT/JSON/CSV |
| **Audio Visualizer** | 13 gaya visual, kustom penuh (warna, glow, pantulan, logo, teks, latar), pratinjau real-time + mikrofon; ekspor `.mov` transparan otomatis (alpha) atau berlatar — PNG / Animation(RLE) / JPEG + audio PCM; ZIP urutan PNG |
| **PDF Lab – Suite** | 9 mode: kompres, gabung, pecah, ekstrak, hapus halaman, putar, atur ulang, gambar→PDF, teks→PDF, plus Sensor/Redaksi PDF (hitamkan info sensitif secara permanen) |
| **Doc Studio** | Editor dokumen dengan Find & Replace, template cepat, snapshot, ekspor .docx / .pdf / .txt |
| **Image Lab** | Kompres, resize, konversi format (JPG/PNG/WEBP), putar — batch processing, plus Color Picker & Palette Extractor |
| **Rak Utilitas** | Kalkulator serba-guna (standar, pajak, bunga, investasi, cicilan/hutang, rumus, HPP/COGS, konversi satuan), Kamus Dunia (terjemahan puluhan bahasa), HTML Preview, Diagram & Rumus Studio (flowchart/struktur/chart + LaTeX), Pengukur Kekuatan Suara, JSON formatter, Base64, bulk teks/data, statistik, password & token generator, dan lainnya |
| **Capture Website** | Screenshot panjang: bagikan layar/tab (jahit otomatis saat scroll) atau HTML/kode (halaman penuh instan), anotasi live (pena, stabilo, garis, panah, bentuk, teks, nomor, sensor, gambar), tumpukan hasil → gambar / ZIP otomatis / PDF rapi |
| **Koordinat** | Cari tempat & pilih titik di peta dunia (Leaflet; peta vektor offline bawaan + OSM/Topo/Satelit/Gelap), semua format koordinat (DD, DMS, DDM, UTM, MGRS, Plus Code, Geohash, Maidenhead, Web Mercator, ubin XYZ) + parser fleksibel, jarak/arah elipsoid, titik tujuan, luas, daftar titik, generate (acak/grid/lingkaran/garis), impor/ekspor CSV·GeoJSON·KML·GPX, negara offline, matahari terbit/terbenam |
| **Office** | Doc Studio, Sheet Studio, Slide Studio, dan **Diagram & Rumus Studio** (dipindah dari Utilitas; URL lama `/utility/diagram-rumus` otomatis dialihkan) |
| **Video Studio** | Potong/cut video, crop & resize (rasio 1:1/9:16/16:9/dst), teks & subtitle (CC — ekspor .SRT/.VTT atau bakar ke video), gabung klip dengan transisi cut/crossfade, kecepatan & filter warna, ekstrak audio & thumbnail — semua ringan, native browser (video+canvas+MediaRecorder), tanpa upload ke server |
| **Spesial** | Kwitansi, Invoice, Struk/Nota, dan Kartu Nama profesional (**mode Massal/Bulk dari Excel·CSV·XLSX: ZIP PNG, PDF, atau lembar cetak dengan crop marks & susunan bolak-balik, plus ekspor vCard**; logo custom, ekspor PNG & PDF, cetak langsung ke printer USB/Bluetooth), generator sertifikat & piagam massal full custom, WA link |

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
