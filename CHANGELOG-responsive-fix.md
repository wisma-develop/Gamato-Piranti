# Gamato Piranti — Responsive/UI-UX Fix Session

## Metodologi verifikasi (bukan tebakan)

Sandbox kerja tidak punya akses internet (`npm install` → `403 Forbidden`, terverifikasi),
jadi tidak bisa `npm run dev`/`vite build`/Chrome Canary sungguhan langsung di sini. Tapi
tersedia offline: **Chromium headless asli** (via Playwright, sudah pre-installed di
`/opt/pw-browsers`) dan **TypeScript compiler asli** (`tsc` v6.0.3, global).

Semua fix di bawah **dites nyata**, bukan dikira-kira:
- Setiap fix CSS/JS diverifikasi dengan skenario device asli di Chromium headless
  (desktop+mouse, iPad, iPhone, touchscreen-laptop) — before/after dibandingkan lewat
  `getComputedStyle`/`getBoundingClientRect` sungguhan.
- Setiap file yang diedit dicek `tsc` (isolated, tanpa gangguan tsconfig lain) untuk
  memastikan nol error sintaks sebelum dan sesudah.
- Full-project `tsc` sweep dijalankan 2x (sebelum & sesudah semua fix) dengan
  path-alias `@/*` di-resolve dan dependency asli (react, pdf-lib, docx) di-link,
  untuk memastikan tidak ada regresi baru di file manapun.

---

## Bug FUNGSIONAL yang ditemukan & diperbaiki

### 1. Import hilang — `GamatoInlineAlert` tidak diimpor di 25 file
**Dampak: crash runtime** (`ReferenceError: GamatoInlineAlert is not defined`) begitu
tool selesai proses dan mencoba menampilkan pesan sukses/gagal.

File: seluruh `src/features/pdf/*` (16 file) dan `src/features/image/*` (9 file) —
PdfWordToPdf, PdfWatermark, PdfUnlock, PdfToWord, PdfToImage, PdfToExcel, PdfSign,
PdfScan, PdfProtect, PdfPptToPdf, PdfPageNumbers, PdfOcr, PdfHtmlToPdf, PdfExcelToPdf,
PdfEdit, HtmlToImage, ImageCompress, ImageConvert, ImageCrop, ImageRemoveBg,
ImageResize, ImageRotate, ImageWatermark, MemeGenerator, PhotoEditor.

**Fix:** tambah `import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";`
di 25 file tsb (batch script, diverifikasi satu per satu anchornya sebelum jalan).

### 2. Import hilang — `GamatoTooltip` tidak diimpor di `ImageInspector.tsx`
Sama persis: crash runtime saat toolbar crop-gambar di Doc Studio dipakai.
**Fix:** tambah import yang hilang.

---

## Bug RESPONSIVE (mobile/tablet/desktop) yang ditemukan & diperbaiki

### 3. Volume slider video/audio player hilang total di tablet & laptop layar sentuh
Root cause: `sm:w-0 sm:group-hover/vol:w-16` — di Tailwind v4 `hover:`/`group-hover:`
hanya aktif kalau device benar-benar punya hover (`@media (hover:hover)`). Di
touchscreen ≥640px (iPad, laptop touchscreen), hover tidak pernah terpicu →
slider permanen `width:0`, tak bisa disentuh sama sekali.

**Terbukti via Chromium:** iPad emulation → `0px` (sebelum fix) → `48px` (sesudah fix).
Desktop+mouse tetap `0px` saat idle → `64px` saat hover (perilaku asli tidak berubah).

**Fix:** class CSS baru `.gp-volume-track`/`.gp-vol-group` di `index.css`, guard pakai
`@media (hover: hover) and (pointer: fine) and (min-width: 640px)` — persis
menyasar kasus "mouse asli", tidak menyasar touch sama sekali.

### 4. CTA "Buka alat →" hilang permanen di tablet (Home & kategori grid)
Bug identik dengan #3 (`sm:opacity-0 sm:group-hover:opacity-100`).
**Fix:** class `.gp-hover-reveal` dengan guard sama.

### 5. Popover warna bisa terpotong di luar layar di HP
`GamatoColorPicker`, `ColorSwatchPicker` (Doc Studio toolbar), dan menu "Sisipkan
bentuk" di `RichToolbar` di-anchor `absolute left-0` tanpa cek batas viewport — kalau
tombolnya ada di kolom kanan (mis. color picker ke-3 dari `grid-cols-3`), sebagian
panel nongol di luar layar dan tak bisa disentuh.

**Terbukti via Chromium:** di layar 320px, panel meleset **149px (58%) di luar layar**
sebelum fix; sesudah fix, pas 100% di dalam viewport di lebar 320/375/414px.

**Fix:** hook baru `useClampedPopover` (`src/hooks/useClampedPopover.ts`) — mengukur
posisi panel setelah mount, dan menggeser via `transform: translateX()` kalau
melewati tepi layar. Murni koreksi posisi, tidak menyentuh logika buka/tutup.

### 6. Tooltip tidak pernah muncul di HP/tablet
`GamatoTooltip` cuma listen `onMouseEnter`/`onMouseLeave` — di touch device, event itu
tidak pernah fire. Dipakai di 9 file termasuk toolbar Doc Studio.
**Fix:** tambah `onTouchStart` yang show tooltip + auto-hide 1.6 detik, tidak
mengganggu `onClick` asli.

### 7. `sticky top-24` tidak konsisten di 4 titik
16 file lain di project sudah benar pakai `lg:sticky lg:top-24` (supaya sidebar tidak
"nyangkut" aneh saat di-stack 1-kolom di mobile). 4 titik ini ketinggalan:
`ToolInfoPanel.tsx` (dipakai di 57 file!), `BarcodeGenerator.tsx`, `QrCodeGenerator.tsx`,
`DocTools.tsx`. **Fix:** disamakan ke pola yang sudah terbukti benar.

---

## Yang DIPERIKSA tapi TIDAK diubah (terbukti bukan bug, ada investigasi di baliknya)

Saat full-project `tsc` sweep, muncul beberapa peringatan type — masing-masing
diinvestigasi sampai tuntas dengan reproduksi terisolasi sebelum diputuskan:

- **`Uint8Array` vs `BlobPart` (~31 lokasi, semua pemanggilan `pdf-lib`'s `.save()`
  → `new Blob(...)`):** artefak versi TypeScript. Sandbox ini punya `tsc` v6.0.3,
  project pin `typescript: 5.9.3` — versi lebih baru mengetatkan tipe `BlobPart` di
  `lib.dom.d.ts`. **Tidak berdampak ke build** (`npm run build` = `vite build`, tidak
  menjalankan `tsc` sebagai gate) dan **tidak berdampak runtime** (browser terima
  `Uint8Array` sebagai `BlobPart` di semua kondisi). Dibiarkan agar tidak mengubah
  kode yang sudah berjalan tanpa manfaat nyata.
- **`ValidationResult.reason` di `BarcodeGenerator.tsx`:** awalnya kelihatan seperti
  bug narrowing TypeScript, ternyata cuma muncul saat opsi compiler `strict: false`
  (project asli pakai `strict: true`) — dites ulang dengan `strict: true` (match
  tsconfig asli project), error hilang total. Bukan bug.
- **`AlertTone` di `ToolInfoPanel.tsx`, `unknown` type di `DocTools.tsx`, dan
  beberapa lainnya:** direproduksi ulang secara terisolasi dengan pola kode identik
  → bersih tanpa error. Kuat dugaan artefak dari stub `lucide-react` (karena paket
  asli tidak bisa di-install offline). Nol dampak runtime.

---

## Yang HARUS Kang lakukan sendiri (di luar kendali sandbox saya)

1. Extract ZIP, lalu:
   ```bash
   npm install
   npm run build      # WAJIB dijalankan — verifikasi build sungguhan
   npm run dev         # untuk preview lokal
   ```
2. **Chrome Canary** (untuk tes visual manual):
   - Windows/Mac: https://www.google.com/chrome/canary/
   - Setelah install, buka DevTools (F12) → toggle "Device Toolbar" (Ctrl+Shift+M) →
     tes preset iPad, iPhone SE, Pixel, dan "Responsive" custom width 320/375/768/1024px.
   - Titik yang wajib dicek manual sesuai fix di atas: (a) slider volume di GamatoPlayer
     saat mode device iPad, (b) color picker di QR Studio pada grid 3-kolom di lebar
     375px, (c) toolbar warna di Doc Studio.
3. Jalankan `npm run build` dan pastikan tidak ada error sebelum push ke GitHub —
   ini langkah verifikasi akhir yang saya TIDAK bisa lakukan di sini karena
   `npm install` diblokir jaringan di sandbox saya.
