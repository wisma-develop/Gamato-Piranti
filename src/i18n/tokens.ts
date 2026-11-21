import { isEn } from "./index";

/**
 * Nama variabel `{{…}}` pada template Surat: kunci internal Indonesia → nama tampilan Inggris.
 * Di mode EN, template, kolom isian, dan teks surat memakai nama Inggris; mesin tetap menerima nama Indonesia
 * (surat lama / berkas draf) lewat `idKey()`.
 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["acara", "event"], ["agenda", "agenda"], ["alamat1", "address1"], ["alamat2", "address2"], ["alamat_pemberi", "grantor_address"],
  ["alamat_penerima", "grantee_address"], ["alamat_perusahaan", "company_address"], ["alamat", "address"], ["alasan", "reason"],
  ["atasan", "manager"], ["batas", "deadline"], ["berlaku_sampai", "valid_until"], ["divisi", "division"], ["email", "email"],
  ["hal", "matter"], ["harga", "price"], ["hari_izin", "absence_day"], ["hari_tanggal", "day_date"], ["hari", "day"],
  ["hubungan", "relationship"], ["isi_pernyataan", "statement"], ["isi_rekomendasi", "recommendation"], ["isi_utama", "main_text"],
  ["jabatan_k", "position_k"], ["jabatan_pejabat", "official_position"], ["jabatan_penerima", "grantee_position"],
  ["jabatan_saya", "my_position"], ["jabatan_ttd", "signer_position"], ["jabatan", "position"], ["jenis_cuti", "leave_type"],
  ["jumlah_lampiran", "attachment_count"], ["kelas", "class"], ["keperluan", "purpose"], ["keterangan", "description"],
  ["keunggulan", "advantages"], ["kota_hukum", "legal_city"], ["lama", "duration"], ["lampiran_list", "attachment_list"],
  ["lampiran", "attachment"], ["lembaga", "institution"], ["lokasi", "location"], ["masa_berlaku", "validity_period"],
  ["mulai", "start"], ["nama_pemberi", "grantor_name"], ["nama_penerima", "grantee_name"], ["nama_ttd", "signer_name"],
  ["nama", "name"], ["nik1", "id_no1"], ["nik2", "id_no2"], ["nik_pemberi", "grantor_id_no"], ["nik_penerima", "grantee_id_no"],
  ["nik", "id_no"], ["nip_penerima", "grantee_emp_no"], ["nip_ttd", "signer_emp_no"], ["nip", "emp_no"], ["nomor", "number"],
  ["objek", "object"], ["pejabat", "official"], ["pekerjaan", "occupation"], ["pelanggaran", "violation"], ["pembuka", "opening"],
  ["penandatangan", "signer"], ["pendidikan", "education"], ["penerima", "recipient"], ["perihal", "subject"],
  ["perusahaan_tujuan", "target_company"], ["perusahaan", "company"], ["pihak1", "party1"], ["pihak2", "party2"], ["poin", "points"],
  ["posisi", "position_applied"], ["produk", "product"], ["rekening", "account"], ["selesai", "end"], ["sumber", "source"],
  ["tabel", "table"], ["tanggal_efektif", "effective_date"], ["tanggal", "date"], ["telepon", "phone"], ["tempat", "place"],
  ["tentang", "about"], ["tingkat_sp", "warning_level"], ["total", "total"], ["ttl", "birth_info"], ["tugas", "assignment"],
  ["tujuan_rek", "recommendation_purpose"], ["tujuan", "recipient_to"], ["up", "attn"], ["variabel", "variable"], ["waktu", "time"],
  ["bulan_romawi", "roman_month"], ["bulan", "month"], ["tahun", "year"],
];
const ID2EN = new Map(PAIRS);
const EN2ID = new Map(PAIRS.map(([a, b]) => [b, a] as const));

/** Nama Inggris → kunci internal (Indonesia). Tidak dikenal → dikembalikan apa adanya. */
export const idKey = (k: string): string => EN2ID.get(k) ?? k;
/** Kunci internal → nama tampilan pada bahasa aktif. */
export const dispKey = (k: string): string => (isEn ? ID2EN.get(k) ?? k : k);

const VAR_ANY = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
/** Ganti semua `{{kunci_id}}` di teks dengan nama tampilan (EN saja). */
export const localizeVars = (s: string): string => (isEn ? s.replace(VAR_ANY, (_m, k: string) => `{{${ID2EN.get(k.toLowerCase()) ?? k}}}`) : s);

/** Salin dalam-dalam objek template dan terapkan `localizeVars` ke setiap string + kunci field. */
export function localizeDeep<T>(v: T): T {
  if (!isEn) return v;
  const walk = (x: unknown, parentKey?: string): unknown => {
    if (typeof x === "string") return parentKey === "key" ? ID2EN.get(x) ?? x : localizeVars(x);
    if (Array.isArray(x)) return x.map((y) => walk(y));
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, y]) => [k, walk(y, k)]));
    return x;
  };
  return walk(v) as T;
}

/** Token satu-kurung `{nama}`, `{nomor}`… (sertifikat, kupon, tanda pengenal): padanan Inggris → Indonesia. */
const SINGLE: Record<string, string> = {
  name: "nama", number: "nomor", date: "tanggal", code: "kode", role: "peran", organization: "instansi", group: "grup",
  event: "acara", note: "catatan", seat: "kursi", zone: "zona", category: "kategori",
};
export const singleKey = (k: string): string => SINGLE[k.toLowerCase()] ?? k.toLowerCase();
