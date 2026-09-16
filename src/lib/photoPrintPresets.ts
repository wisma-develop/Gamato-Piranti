// Preset paper sizes and photo/pas-foto sizes for the "Cetak Foto" tool.
// All dimensions in millimeters (portrait orientation as the base — the
// print engine decides whether to actually use the paper portrait or
// landscape to maximize how many photos fit).

export interface PaperSizeDef {
  id: string;
  label: string;
  wMm: number;
  hMm: number;
}

export interface PhotoSizeDef {
  id: string;
  label: string;
  wMm: number;
  hMm: number;
  group: "Pas Foto" | "Cetak Foto" | "Lainnya";
}

export const PAPER_SIZES: PaperSizeDef[] = [
  { id: "a4", label: "A4 (210 × 297 mm)", wMm: 210, hMm: 297 },
  { id: "f4", label: "F4 / Folio (215 × 330 mm)", wMm: 215, hMm: 330 },
  { id: "letter", label: "Letter (215.9 × 279.4 mm)", wMm: 215.9, hMm: 279.4 },
  { id: "3r", label: "Kertas Foto 3R (89 × 127 mm)", wMm: 89, hMm: 127 },
  { id: "4r", label: "Kertas Foto 4R (102 × 152 mm)", wMm: 102, hMm: 152 },
  { id: "5r", label: "Kertas Foto 5R (127 × 178 mm)", wMm: 127, hMm: 178 },
  { id: "6r", label: "Kertas Foto 6R (152 × 203 mm)", wMm: 152, hMm: 203 },
  { id: "8r", label: "Kertas Foto 8R (203 × 254 mm)", wMm: 203, hMm: 254 },
  { id: "custom", label: "Ukuran Kustom", wMm: 210, hMm: 297 },
];

export const PHOTO_SIZES: PhotoSizeDef[] = [
  { id: "pf-2x3", label: "Pas Foto 2×3 cm", wMm: 20, hMm: 30, group: "Pas Foto" },
  { id: "pf-3x4", label: "Pas Foto 3×4 cm", wMm: 30, hMm: 40, group: "Pas Foto" },
  { id: "pf-4x6", label: "Pas Foto 4×6 cm", wMm: 40, hMm: 60, group: "Pas Foto" },
  { id: "pf-3.5x4.5", label: "Pas Foto 3.5×4.5 cm (Paspor/Visa)", wMm: 35, hMm: 45, group: "Pas Foto" },
  { id: "cetak-2r", label: "Cetak 2R (6 × 9 cm)", wMm: 60, hMm: 90, group: "Cetak Foto" },
  { id: "cetak-3r", label: "Cetak 3R (8.9 × 12.7 cm)", wMm: 89, hMm: 127, group: "Cetak Foto" },
  { id: "cetak-4r", label: "Cetak 4R (10.2 × 15.2 cm)", wMm: 102, hMm: 152, group: "Cetak Foto" },
  { id: "cetak-5r", label: "Cetak 5R (12.7 × 17.8 cm)", wMm: 127, hMm: 178, group: "Cetak Foto" },
  { id: "custom", label: "Ukuran Kustom", wMm: 30, hMm: 40, group: "Lainnya" },
];

export function getPaperSize(id: string): PaperSizeDef | undefined {
  return PAPER_SIZES.find((p) => p.id === id);
}

export function getPhotoSize(id: string): PhotoSizeDef | undefined {
  return PHOTO_SIZES.find((p) => p.id === id);
}
