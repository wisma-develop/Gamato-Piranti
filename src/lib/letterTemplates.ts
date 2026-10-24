// Template Surat Generator. Setiap template: isian cepat (fields) + isi surat (blocks)
// + pengaturan surat/tanda tangan (patch). Teks memakai {{variabel}} yang diganti saat render.

import { blankLetter, blk, dataRow, newSigner, type LetterBlock, type LetterDoc, type TemplateField } from "@/lib/letterTypes";
import { todayISODate } from "@/lib/dateFormat";

export type TemplateCategory = "Resmi & Instansi" | "Bisnis" | "Pribadi & Kerja" | "Hukum & Perjanjian";

export interface LetterTemplate {
  id: string;
  name: string;
  cat: TemplateCategory;
  desc: string;
  fields: TemplateField[];
  patch: Partial<LetterDoc>;
  blocks: LetterBlock[];
}

const F = (key: string, label: string, value: string, type: TemplateField["type"] = "text", extra: Partial<TemplateField> = {}): TemplateField => ({ key, label, type, value, ...extra });

const CLOSE = "Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.";
const CLOSE_P = "Demikian surat ini saya sampaikan. Atas perhatian dan pertimbangan Bapak/Ibu, saya ucapkan terima kasih.";

const ttdFields = (nama: string, jabatan: string, nip = ""): TemplateField[] => [
  F("nama_ttd", "Nama penanda tangan", nama),
  F("jabatan_ttd", "Jabatan penanda tangan", jabatan),
  ...(nip !== null ? [F("nip_ttd", "NIP / NIK (opsional)", nip)] : []),
];

const idBlock = (): LetterBlock => blk("data", "", { labelWidth: 38, rows: [
  dataRow("Nama", "{{nama}}"), dataRow("Tempat/Tgl. Lahir", "{{ttl}}"), dataRow("Pekerjaan", "{{pekerjaan}}"), dataRow("Alamat", "{{alamat}}"),
] });

const personFields = (): TemplateField[] => [
  F("nama", "Nama lengkap", "Budi Santoso"),
  F("ttl", "Tempat/tanggal lahir", "Bandung, 14 Mei 1995"),
  F("pekerjaan", "Pekerjaan", "Karyawan Swasta"),
  F("alamat", "Alamat", "Jl. Melati No. 12, Kelurahan Sukamaju, Bandung", "textarea"),
];

const kopOn: Partial<LetterDoc> = { kopEnabled: true, kopStyle: "klasik", kopLine: "double" };

export const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    id: "kosong", name: "Kosong", cat: "Pribadi & Kerja", desc: "Mulai dari lembar kosong, susun sendiri blok isinya.",
    fields: [], patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "top" },
    blocks: [blk("paragraph", "Tulis isi surat di sini…", { indent: true })],
  },
  {
    id: "dinas", name: "Surat Dinas Resmi", cat: "Resmi & Instansi", desc: "Kop instansi, nomor otomatis, perihal, dan penutup baku.",
    fields: [
      F("tujuan", "Ditujukan kepada", "Kepala Sekolah SMP Negeri 1 Contoh"),
      F("tempat", "Tempat", "Tempat"),
      F("isi_utama", "Isi pembuka", "Sehubungan dengan pelaksanaan program peningkatan mutu pendidikan tahun 2026, bersama ini kami mengundang Bapak/Ibu untuk menghadiri rapat koordinasi yang akan dilaksanakan pada:", "textarea"),
      F("hari_tanggal", "Hari/tanggal kegiatan", todayISODate(), "date"),
      F("waktu", "Waktu", "09.00 WIB – selesai"),
      F("lokasi", "Tempat kegiatan", "Aula Dinas Pendidikan"),
      ...ttdFields("Dr. Ahmad Fauzi, M.Pd.", "Kepala Dinas Pendidikan", "197001011995031001"),
    ],
    patch: { ...kopOn, kopLine1: "PEMERINTAH KOTA CONTOH", kopName: "DINAS PENDIDIKAN", metaEnabled: true, numberMode: "auto", noKode: "DISDIK", sifat: "Penting", lampiran: "-", perihal: "Undangan Rapat Koordinasi", addressee: "Yth. {{tujuan}}\ndi {{tempat}}", dateLocation: "top", dateAlign: "right", signLayout: "right", tembusan: "Wali Kota Contoh (sebagai laporan)\nArsip",
      signers: [newSigner({ heading: "Hormat kami,", role: "{{jabatan_ttd}}", name: "{{nama_ttd}}", idLabel: "NIP.", idValue: "{{nip_ttd}}" })] },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "{{isi_utama}}", { indent: true }),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Hari/Tanggal", "{{hari}}, {{hari_tanggal}}"), dataRow("Waktu", "{{waktu}}"), dataRow("Tempat", "{{lokasi}}")] }),
      blk("paragraph", "Mengingat pentingnya acara tersebut, kami mohon kehadiran Bapak/Ibu tepat waktu. " + CLOSE, { indent: true }),
    ],
  },
  {
    id: "bisnis", name: "Surat Penawaran Bisnis", cat: "Bisnis", desc: "Penawaran produk/jasa lengkap dengan harga & keunggulan.",
    fields: [
      F("perusahaan_tujuan", "Perusahaan tujuan", "PT Maju Bersama"),
      F("up", "Up. (untuk perhatian)", "Bapak Rudi Hartono, Manajer Pengadaan"),
      F("produk", "Produk / jasa", "Paket Layanan Digital Marketing"),
      F("harga", "Harga penawaran", "Rp 12.500.000 per bulan"),
      F("keunggulan", "Keunggulan (satu baris satu butir)", "Tim berpengalaman lebih dari 8 tahun\nLaporan kinerja mingguan transparan\nGaransi revisi tanpa biaya tambahan\nDukungan pelanggan 24/7", "textarea"),
      F("berlaku_sampai", "Penawaran berlaku sampai", todayISODate(), "date"),
      ...ttdFields("Dewi Lestari", "Direktur Pemasaran"),
    ],
    patch: { kopEnabled: true, kopStyle: "samping", kopLine: "single", kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", kopColor: "#1e3a8a", metaEnabled: true, numberMode: "auto", noKode: "GKN/PNW", lampiran: "1 (satu) berkas", perihal: "Penawaran {{produk}}", addressee: "Kepada Yth.\n{{perusahaan_tujuan}}\nUp. {{up}}\ndi tempat", signers: [newSigner({ heading: "Hormat kami,", role: "{{jabatan_ttd}}", name: "{{nama_ttd}}" })] },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Terima kasih atas kesempatan yang diberikan kepada kami. Melalui surat ini, kami mengajukan penawaran **{{produk}}** untuk {{perusahaan_tujuan}} dengan keunggulan sebagai berikut:", { indent: true }),
      blk("numbered", "{{keunggulan}}", { numStyle: "1." }),
      blk("data", "", { labelWidth: 40, rows: [dataRow("Produk / jasa", "{{produk}}"), dataRow("Harga", "{{harga}}"), dataRow("Masa berlaku", "s/d {{berlaku_sampai}}")] }),
      blk("paragraph", "Kami siap mendiskusikan rincian lebih lanjut sesuai kebutuhan Bapak/Ibu. " + CLOSE, { indent: true }),
    ],
  },
  {
    id: "lamaran", name: "Surat Lamaran Kerja", cat: "Pribadi & Kerja", desc: "Lamaran pekerjaan lengkap dengan data diri & daftar lampiran.",
    fields: [
      F("perusahaan", "Perusahaan tujuan", "PT Teknologi Nusantara"),
      F("alamat_perusahaan", "Alamat perusahaan", "Jl. Sudirman No. 45, Jakarta"),
      F("posisi", "Posisi dilamar", "Staf Administrasi"),
      F("sumber", "Sumber informasi lowongan", "situs karier perusahaan"),
      ...personFields(),
      F("pendidikan", "Pendidikan terakhir", "S1 Manajemen, Universitas Contoh"),
      F("telepon", "Telepon", "0812-3456-7890"),
      F("email", "Email", "budi.santoso@email.com"),
      F("lampiran_list", "Daftar lampiran (satu baris satu butir)", "Curriculum Vitae\nFotokopi KTP\nFotokopi ijazah & transkrip nilai\nPas foto 3×4 terbaru\nSertifikat pendukung", "textarea"),
    ],
    patch: { kopEnabled: false, metaEnabled: true, numberMode: "manual", nomor: "", sifat: "", lampiran: "{{jumlah_lampiran}}", perihal: "Lamaran Pekerjaan", addressee: "Yth. Bapak/Ibu Pimpinan / HRD\n{{perusahaan}}\n{{alamat_perusahaan}}", dateLocation: "top", dateAlign: "right", signers: [newSigner({ heading: "Hormat saya,", name: "{{nama}}" })], signGap: 24,
      vars: { jumlah_lampiran: "5 (lima) berkas" } },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Berdasarkan informasi yang saya peroleh dari {{sumber}}, bahwa perusahaan Bapak/Ibu membutuhkan tenaga kerja untuk posisi **{{posisi}}**, maka saya yang bertanda tangan di bawah ini:", { indent: true }),
      blk("data", "", { labelWidth: 38, rows: [dataRow("Nama", "{{nama}}"), dataRow("Tempat/Tgl. Lahir", "{{ttl}}"), dataRow("Pendidikan", "{{pendidikan}}"), dataRow("Alamat", "{{alamat}}"), dataRow("Telepon", "{{telepon}}"), dataRow("Email", "{{email}}")] }),
      blk("paragraph", "bermaksud mengajukan lamaran untuk bergabung dengan {{perusahaan}}. Saya memiliki motivasi tinggi, mampu bekerja dalam tim maupun mandiri, serta siap belajar dan ditempatkan sesuai kebutuhan perusahaan."),
      blk("paragraph", "Sebagai bahan pertimbangan, bersama surat ini saya lampirkan:", { indent: true }),
      blk("numbered", "{{lampiran_list}}"),
      blk("paragraph", CLOSE_P, { indent: true }),
    ],
  },
  {
    id: "resign", name: "Surat Pengunduran Diri", cat: "Pribadi & Kerja", desc: "Surat resign sopan dengan tanggal efektif.",
    fields: [
      F("atasan", "Ditujukan kepada", "Bapak/Ibu Pimpinan"),
      F("perusahaan", "Perusahaan", "PT Teknologi Nusantara"),
      F("nama", "Nama", "Budi Santoso"),
      F("jabatan_saya", "Jabatan", "Staf Administrasi"),
      F("divisi", "Divisi / bagian", "Umum"),
      F("tanggal_efektif", "Tanggal efektif berhenti", todayISODate(), "date"),
      F("alasan", "Alasan", "ingin mengembangkan karier di bidang lain", "textarea"),
    ],
    patch: { kopEnabled: false, metaEnabled: true, perihal: "Pengunduran Diri", lampiran: "", sifat: "", addressee: "Yth. {{atasan}}\n{{perusahaan}}\ndi tempat", dateLocation: "top", signers: [newSigner({ heading: "Hormat saya,", name: "{{nama}}" })], signGap: 24 },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 30, rows: [dataRow("Nama", "{{nama}}"), dataRow("Jabatan", "{{jabatan_saya}}"), dataRow("Divisi", "{{divisi}}")] }),
      blk("paragraph", "Dengan ini mengajukan pengunduran diri dari {{perusahaan}}, efektif per tanggal **{{tanggal_efektif}}**, karena {{alasan}}.", { indent: true }),
      blk("paragraph", "Saya mengucapkan terima kasih atas kesempatan, bimbingan, dan pengalaman berharga selama bekerja di perusahaan ini. Saya bersedia menyelesaikan seluruh tanggung jawab dan serah terima pekerjaan hingga tanggal efektif tersebut.", { indent: true }),
      blk("paragraph", "Mohon maaf atas segala kekurangan selama saya bekerja. " + CLOSE_P, { indent: true }),
    ],
  },
  {
    id: "izin", name: "Surat Izin Tidak Masuk", cat: "Pribadi & Kerja", desc: "Izin sekolah/kerja — singkat dan rapi.",
    fields: [
      F("tujuan", "Ditujukan kepada", "Bapak/Ibu Wali Kelas VII-A"),
      F("lembaga", "Sekolah / kantor", "SMP Negeri 1 Contoh"),
      F("nama", "Nama yang izin", "Andi Pratama"),
      F("kelas", "Kelas / jabatan", "VII-A"),
      F("hari_izin", "Hari / tanggal izin", "Senin, 12 Januari 2026"),
      F("alasan", "Alasan", "sakit demam sehingga perlu beristirahat di rumah", "textarea"),
      F("nama_ttd", "Nama penanda tangan", "Siti Rahma"),
      F("hubungan", "Hubungan (mis. Orang tua/Wali)", "Orang tua/Wali"),
    ],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "Yth. {{tujuan}}\n{{lembaga}}\ndi tempat", dateLocation: "top", signers: [newSigner({ heading: "{{hubungan}},", name: "{{nama_ttd}}" })], signGap: 22 },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Yang bertanda tangan di bawah ini, {{hubungan}} dari:"),
      blk("data", "", { labelWidth: 30, rows: [dataRow("Nama", "{{nama}}"), dataRow("Kelas/Jabatan", "{{kelas}}")] }),
      blk("paragraph", "memberitahukan bahwa yang bersangkutan tidak dapat mengikuti kegiatan di {{lembaga}} pada hari {{hari_izin}} karena {{alasan}}.", { indent: true }),
      blk("paragraph", "Demikian surat izin ini disampaikan. Atas pengertian Bapak/Ibu, kami ucapkan terima kasih.", { indent: true }),
    ],
  },
  {
    id: "keterangan", name: "Surat Keterangan", cat: "Resmi & Instansi", desc: "Surat keterangan umum dengan judul bernomor.",
    fields: [
      F("pejabat", "Nama pejabat", "Hj. Rahmawati, S.Sos."), F("jabatan_pejabat", "Jabatan pejabat", "Kepala Desa Sukamaju"),
      ...personFields(),
      F("keterangan", "Isi keterangan", "adalah benar warga yang berdomisili di wilayah Desa Sukamaju dan berkelakuan baik selama tinggal di wilayah kami.", "textarea"),
      F("keperluan", "Keperluan", "melengkapi persyaratan administrasi"),
      F("nama_ttd", "Nama penanda tangan", "Hj. Rahmawati, S.Sos."), F("jabatan_ttd", "Jabatan penanda tangan", "Kepala Desa Sukamaju"),
    ],
    patch: { ...kopOn, kopLine1: "PEMERINTAH KABUPATEN CONTOH", kopName: "DESA SUKAMAJU", numberMode: "auto", noKode: "SK/DS", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: "{{jabatan_ttd}},", role: "", name: "{{nama_ttd}}" })], signGap: 24 },
    blocks: [
      blk("heading", "SURAT KETERANGAN", { underline: true, sub: "Nomor: {{nomor}}" }),
      blk("paragraph", "Yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 38, rows: [dataRow("Nama", "{{pejabat}}"), dataRow("Jabatan", "{{jabatan_pejabat}}")] }),
      blk("paragraph", "Menerangkan dengan sesungguhnya bahwa:"),
      idBlock(),
      blk("paragraph", "{{keterangan}}", { indent: true }),
      blk("paragraph", "Surat keterangan ini dibuat untuk {{keperluan}} dan dapat dipergunakan sebagaimana mestinya.", { indent: true }),
    ],
  },
  {
    id: "kuasa", name: "Surat Kuasa", cat: "Hukum & Perjanjian", desc: "Pemberi & penerima kuasa, dua kolom tanda tangan + materai.",
    fields: [
      F("nama_pemberi", "Nama pemberi kuasa", "Budi Santoso"), F("nik_pemberi", "NIK pemberi", "3273011405950001"), F("alamat_pemberi", "Alamat pemberi", "Jl. Melati No. 12, Bandung", "textarea"),
      F("nama_penerima", "Nama penerima kuasa", "Agus Wijaya"), F("nik_penerima", "NIK penerima", "3273012003980002"), F("alamat_penerima", "Alamat penerima", "Jl. Kenanga No. 8, Bandung", "textarea"),
      F("keperluan", "Untuk keperluan", "mengambil dokumen kendaraan bermotor di kantor Samsat Kota Bandung", "textarea"),
    ],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "signature", signLayout: "two", materai: true, signGap: 26,
      signers: [newSigner({ heading: "Penerima Kuasa,", name: "{{nama_penerima}}" }), newSigner({ heading: "Pemberi Kuasa,", name: "{{nama_pemberi}}" })] },
    blocks: [
      blk("heading", "SURAT KUASA", { underline: true }),
      blk("paragraph", "Yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 30, rows: [dataRow("Nama", "{{nama_pemberi}}"), dataRow("NIK", "{{nik_pemberi}}"), dataRow("Alamat", "{{alamat_pemberi}}")] }),
      blk("paragraph", "Selanjutnya disebut sebagai **Pemberi Kuasa**. Dengan ini memberikan kuasa penuh kepada:"),
      blk("data", "", { labelWidth: 30, rows: [dataRow("Nama", "{{nama_penerima}}"), dataRow("NIK", "{{nik_penerima}}"), dataRow("Alamat", "{{alamat_penerima}}")] }),
      blk("paragraph", "Selanjutnya disebut sebagai **Penerima Kuasa**.", {}),
      blk("paragraph", "------------------------------ KHUSUS ------------------------------", { align: "center", bold: true }),
      blk("paragraph", "Untuk dan atas nama Pemberi Kuasa guna {{keperluan}}.", { indent: true }),
      blk("paragraph", "Demikian surat kuasa ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.", { indent: true }),
    ],
  },
  {
    id: "undangan", name: "Surat Undangan", cat: "Resmi & Instansi", desc: "Undangan rapat/acara dengan hari, waktu, tempat, agenda.",
    fields: [
      F("tujuan", "Ditujukan kepada", "Bapak/Ibu Pengurus RW 05"), F("acara", "Nama acara", "Rapat Pengurus Bulanan"),
      F("hari_tanggal", "Tanggal acara", todayISODate(), "date"), F("waktu", "Waktu", "19.30 WIB – selesai"), F("lokasi", "Tempat", "Balai Warga RW 05"), F("agenda", "Agenda", "Evaluasi kegiatan & rencana kerja bulan depan"),
      ...ttdFields("H. Sutrisno", "Ketua RW 05"),
    ],
    patch: { ...kopOn, kopLine1: "", kopName: "PENGURUS RW 05 KELURAHAN CONTOH", kopLine: "single", metaEnabled: true, numberMode: "auto", noKode: "UND/RW05", lampiran: "-", perihal: "Undangan {{acara}}", addressee: "Yth. {{tujuan}}\ndi tempat", dateLocation: "top", signers: [newSigner({ heading: "Hormat kami,", role: "{{jabatan_ttd}}", name: "{{nama_ttd}}" })] },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Sehubungan dengan akan diselenggarakannya **{{acara}}**, kami mengundang Bapak/Ibu untuk hadir pada:", { indent: true }),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Hari/Tanggal", "{{hari}}, {{hari_tanggal}}"), dataRow("Waktu", "{{waktu}}"), dataRow("Tempat", "{{lokasi}}"), dataRow("Agenda", "{{agenda}}")] }),
      blk("paragraph", "Mengingat pentingnya acara tersebut, kehadiran Bapak/Ibu sangat kami harapkan. " + CLOSE, { indent: true }),
    ],
  },
  {
    id: "pernyataan", name: "Surat Pernyataan", cat: "Hukum & Perjanjian", desc: "Pernyataan bermaterai dengan data diri pembuat.",
    fields: [...personFields(), F("isi_pernyataan", "Isi pernyataan", "seluruh data dan dokumen yang saya serahkan adalah benar dan sah, serta saya bersedia menerima sanksi sesuai ketentuan yang berlaku apabila di kemudian hari terbukti tidak benar.", "textarea")],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "signature", materai: true, signGap: 26, signers: [newSigner({ heading: "Yang membuat pernyataan,", name: "{{nama}}" })] },
    blocks: [
      blk("heading", "SURAT PERNYATAAN", { underline: true }),
      blk("paragraph", "Yang bertanda tangan di bawah ini:"),
      idBlock(),
      blk("paragraph", "Dengan ini menyatakan dengan sebenar-benarnya bahwa {{isi_pernyataan}}", { indent: true }),
      blk("paragraph", "Demikian surat pernyataan ini saya buat dengan sebenarnya, tanpa paksaan dari pihak manapun, dan dapat dipertanggungjawabkan secara hukum.", { indent: true }),
    ],
  },
  {
    id: "permohonan", name: "Surat Permohonan", cat: "Pribadi & Kerja", desc: "Permohonan umum (izin, bantuan, keringanan, dll).",
    fields: [F("tujuan", "Ditujukan kepada", "Bapak/Ibu Kepala Dinas Contoh"), F("tempat", "Tempat", "Tempat"), ...personFields(), F("hal", "Hal yang dimohonkan", "izin penggunaan lapangan untuk kegiatan bakti sosial", "textarea"), F("alasan", "Alasan / latar belakang", "kegiatan ini bertujuan membantu warga terdampak dan melibatkan pemuda setempat", "textarea")],
    patch: { kopEnabled: false, metaEnabled: true, perihal: "Permohonan", sifat: "", lampiran: "-", addressee: "Yth. {{tujuan}}\ndi {{tempat}}", dateLocation: "top", signers: [newSigner({ heading: "Hormat saya,", name: "{{nama}}" })] },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Saya yang bertanda tangan di bawah ini:"),
      idBlock(),
      blk("paragraph", "Dengan ini mengajukan permohonan {{hal}}. Adapun alasan pengajuan permohonan ini adalah {{alasan}}.", { indent: true }),
      blk("paragraph", "Besar harapan saya agar permohonan ini dapat dikabulkan. " + CLOSE_P, { indent: true }),
    ],
  },
  {
    id: "edaran", name: "Surat Edaran", cat: "Resmi & Instansi", desc: "Pemberitahuan resmi dengan judul 'Tentang' dan poin-poin.",
    fields: [F("tentang", "Tentang", "Pelaksanaan Jam Kerja Selama Bulan Ramadan"), F("pembuka", "Paragraf pembuka", "Menindaklanjuti kebijakan pimpinan terkait penyesuaian waktu kerja, dengan ini kami sampaikan hal-hal sebagai berikut:", "textarea"), F("poin", "Poin-poin (satu baris satu butir)", "Jam kerja Senin–Kamis pukul 08.00–15.00 WIB\nJam kerja Jumat pukul 08.00–15.30 WIB\nIstirahat pukul 12.00–12.30 WIB\nKetentuan lain tetap mengikuti peraturan yang berlaku", "textarea"), ...ttdFields("Ir. Hendra Wijaya", "Direktur Utama")],
    patch: { ...kopOn, kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", numberMode: "auto", noKode: "SE/DIR", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: "Direktur Utama,", role: "", name: "{{nama_ttd}}" })], tembusan: "Seluruh Kepala Divisi\nArsip" },
    blocks: [
      blk("heading", "SURAT EDARAN", { underline: false, sub: "Nomor: {{nomor}}" }),
      blk("paragraph", "**Tentang: {{tentang}}**", { align: "center" }),
      blk("paragraph", "{{pembuka}}", { indent: true }),
      blk("numbered", "{{poin}}"),
      blk("paragraph", "Demikian surat edaran ini disampaikan untuk dilaksanakan dengan penuh tanggung jawab. Terima kasih.", { indent: true }),
    ],
  },
  {
    id: "tugas", name: "Surat Tugas", cat: "Resmi & Instansi", desc: "Penugasan pegawai untuk kegiatan tertentu.",
    fields: [F("pejabat", "Nama pemberi tugas", "Ir. Hendra Wijaya"), F("jabatan_pejabat", "Jabatan pemberi tugas", "Direktur Utama"), F("penerima", "Nama yang ditugaskan", "Budi Santoso"), F("nip_penerima", "NIP / NIK", "198501012010011002"), F("jabatan_penerima", "Jabatan yang ditugaskan", "Staf Keuangan"), F("tugas", "Tugas", "mengikuti pelatihan peningkatan kompetensi keuangan", "textarea"), F("hari_tanggal", "Tanggal pelaksanaan", todayISODate(), "date"), F("lokasi", "Tempat", "Hotel Contoh, Jakarta"), ...ttdFields("Ir. Hendra Wijaya", "Direktur Utama")],
    patch: { ...kopOn, kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", numberMode: "auto", noKode: "ST/DIR", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: "{{jabatan_ttd}},", role: "", name: "{{nama_ttd}}" })] },
    blocks: [
      blk("heading", "SURAT TUGAS", { underline: true, sub: "Nomor: {{nomor}}" }),
      blk("paragraph", "Yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Nama", "{{pejabat}}"), dataRow("Jabatan", "{{jabatan_pejabat}}")] }),
      blk("paragraph", "Dengan ini memberi tugas kepada:"),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Nama", "{{penerima}}"), dataRow("NIP/NIK", "{{nip_penerima}}"), dataRow("Jabatan", "{{jabatan_penerima}}")] }),
      blk("paragraph", "Untuk {{tugas}} yang dilaksanakan pada:"),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Hari/Tanggal", "{{hari}}, {{hari_tanggal}}"), dataRow("Tempat", "{{lokasi}}")] }),
      blk("paragraph", "Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan melaporkan hasilnya kepada pemberi tugas.", { indent: true }),
    ],
  },
  {
    id: "rekomendasi", name: "Surat Rekomendasi", cat: "Pribadi & Kerja", desc: "Rekomendasi untuk karyawan, mahasiswa, atau siswa.",
    fields: [F("pejabat", "Nama pemberi rekomendasi", "Prof. Dr. Siti Aminah, M.Sc."), F("jabatan_pejabat", "Jabatan", "Dosen Pembimbing Akademik"), F("nama", "Nama yang direkomendasikan", "Budi Santoso"), F("posisi", "Status/jabatan", "Mahasiswa Program Studi Teknik Informatika"), F("tujuan_rek", "Tujuan rekomendasi", "mengajukan beasiswa S2"), F("isi_rekomendasi", "Isi rekomendasi", "Selama bimbingan, yang bersangkutan menunjukkan kemampuan akademik yang sangat baik, disiplin, jujur, dan mampu bekerja sama dalam tim. Oleh karena itu, saya memberikan rekomendasi tanpa keraguan.", "textarea"), ...ttdFields("Prof. Dr. Siti Aminah, M.Sc.", "Dosen Pembimbing Akademik")],
    patch: { ...kopOn, kopName: "UNIVERSITAS CONTOH", kopLine1: "FAKULTAS TEKNIK", numberMode: "auto", noKode: "REK/FT", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: "Hormat saya,", role: "{{jabatan_ttd}}", name: "{{nama_ttd}}" })] },
    blocks: [
      blk("heading", "SURAT REKOMENDASI", { underline: true, sub: "Nomor: {{nomor}}" }),
      blk("paragraph", "Yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Nama", "{{pejabat}}"), dataRow("Jabatan", "{{jabatan_pejabat}}")] }),
      blk("paragraph", "Dengan ini memberikan rekomendasi kepada:"),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Nama", "{{nama}}"), dataRow("Status", "{{posisi}}")] }),
      blk("paragraph", "untuk {{tujuan_rek}}. {{isi_rekomendasi}}", { indent: true }),
      blk("paragraph", "Demikian surat rekomendasi ini dibuat untuk dipergunakan sebagaimana mestinya.", { indent: true }),
    ],
  },
  {
    id: "peringatan", name: "Surat Peringatan (SP)", cat: "Resmi & Instansi", desc: "SP karyawan dengan pelanggaran & konsekuensi.",
    fields: [F("tingkat_sp", "Tingkat", "I", "select", { options: ["I", "II", "III"] }), F("nama", "Nama karyawan", "Budi Santoso"), F("nik", "NIK / ID karyawan", "EMP-0123"), F("jabatan_k", "Jabatan", "Staf Gudang"), F("pelanggaran", "Pelanggaran", "terlambat masuk kerja lebih dari 5 kali dalam bulan Januari 2026 tanpa keterangan yang sah", "textarea"), F("masa_berlaku", "Masa berlaku SP", "3 (tiga) bulan"), ...ttdFields("Dewi Lestari", "Manajer HRD")],
    patch: { ...kopOn, kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", numberMode: "auto", noKode: "SP/HRD", metaEnabled: false, addressee: "", dateLocation: "signature", materai: false, signLayout: "two", signers: [newSigner({ heading: "Karyawan yang bersangkutan,", name: "{{nama}}" }), newSigner({ heading: "Hormat kami,", role: "{{jabatan_ttd}}", name: "{{nama_ttd}}" })] },
    blocks: [
      blk("heading", "SURAT PERINGATAN {{tingkat_sp}}", { underline: true, sub: "Nomor: {{nomor}}" }),
      blk("paragraph", "Surat peringatan ini ditujukan kepada:"),
      blk("data", "", { labelWidth: 34, rows: [dataRow("Nama", "{{nama}}"), dataRow("NIK / ID", "{{nik}}"), dataRow("Jabatan", "{{jabatan_k}}")] }),
      blk("paragraph", "Berdasarkan hasil evaluasi, yang bersangkutan telah melakukan pelanggaran berupa {{pelanggaran}}.", { indent: true }),
      blk("paragraph", "Sehubungan dengan hal tersebut, kami menyampaikan:"),
      blk("numbered", "Surat peringatan ini berlaku selama {{masa_berlaku}} sejak tanggal diterbitkan.\nKaryawan wajib memperbaiki kinerja dan kedisiplinan.\nApabila pelanggaran terulang, perusahaan akan memberikan sanksi yang lebih berat sesuai peraturan perusahaan."),
      blk("paragraph", "Demikian surat peringatan ini disampaikan untuk diperhatikan dan dilaksanakan sebagaimana mestinya.", { indent: true }),
    ],
  },
  {
    id: "sewa", name: "Perjanjian Sewa Menyewa", cat: "Hukum & Perjanjian", desc: "Perjanjian sewa sederhana dengan pasal-pasal & materai.",
    fields: [F("pihak1", "Nama pemilik (Pihak Pertama)", "Hj. Rahmawati"), F("nik1", "NIK Pihak Pertama", "3273014507700003"), F("alamat1", "Alamat Pihak Pertama", "Jl. Anggrek No. 3, Bandung", "textarea"), F("pihak2", "Nama penyewa (Pihak Kedua)", "Budi Santoso"), F("nik2", "NIK Pihak Kedua", "3273011405950001"), F("alamat2", "Alamat Pihak Kedua", "Jl. Melati No. 12, Bandung", "textarea"), F("objek", "Objek sewa", "satu unit rumah tinggal di Jl. Anggrek No. 3, Bandung"), F("lama", "Lama sewa", "12 (dua belas) bulan"), F("mulai", "Mulai sewa", todayISODate(), "date"), F("harga", "Harga sewa total", "Rp 36.000.000,- (tiga puluh enam juta rupiah)"), F("kota_hukum", "Kota penyelesaian sengketa", "Bandung")],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "signature", signLayout: "two", materai: true, signGap: 26, signers: [newSigner({ heading: "PIHAK PERTAMA,", name: "{{pihak1}}" }), newSigner({ heading: "PIHAK KEDUA,", name: "{{pihak2}}" })] },
    blocks: [
      blk("heading", "SURAT PERJANJIAN SEWA MENYEWA", { underline: true }),
      blk("paragraph", "Pada hari ini, {{hari}}, tanggal {{tanggal}}, yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 26, rows: [dataRow("1. Nama", "{{pihak1}}"), dataRow("    NIK", "{{nik1}}"), dataRow("    Alamat", "{{alamat1}}")] }),
      blk("paragraph", "selanjutnya disebut **PIHAK PERTAMA** (pemilik), dan"),
      blk("data", "", { labelWidth: 26, rows: [dataRow("2. Nama", "{{pihak2}}"), dataRow("    NIK", "{{nik2}}"), dataRow("    Alamat", "{{alamat2}}")] }),
      blk("paragraph", "selanjutnya disebut **PIHAK KEDUA** (penyewa). Kedua belah pihak sepakat mengadakan perjanjian sewa menyewa dengan ketentuan sebagai berikut:"),
      blk("heading", "Pasal 1", { sub: "Objek Sewa" }),
      blk("paragraph", "PIHAK PERTAMA menyewakan kepada PIHAK KEDUA {{objek}}.", { indent: true }),
      blk("heading", "Pasal 2", { sub: "Jangka Waktu" }),
      blk("paragraph", "Perjanjian ini berlaku selama {{lama}}, terhitung mulai tanggal {{mulai}}.", { indent: true }),
      blk("heading", "Pasal 3", { sub: "Harga & Pembayaran" }),
      blk("paragraph", "Harga sewa selama jangka waktu tersebut sebesar {{harga}}, yang dibayarkan oleh PIHAK KEDUA kepada PIHAK PERTAMA pada saat perjanjian ini ditandatangani.", { indent: true }),
      blk("heading", "Pasal 4", { sub: "Hak & Kewajiban" }),
      blk("numbered", "PIHAK KEDUA wajib menjaga dan merawat objek sewa dengan baik.\nPIHAK KEDUA dilarang menyewakan kembali objek sewa kepada pihak lain tanpa izin tertulis PIHAK PERTAMA.\nPIHAK KEDUA wajib mengembalikan objek sewa dalam keadaan baik pada saat jangka waktu berakhir."),
      blk("heading", "Pasal 5", { sub: "Penyelesaian Perselisihan" }),
      blk("paragraph", "Apabila terjadi perselisihan, kedua belah pihak sepakat menyelesaikannya secara musyawarah. Jika tidak tercapai mufakat, perselisihan akan diselesaikan melalui Pengadilan Negeri {{kota_hukum}}.", { indent: true }),
      blk("paragraph", "Demikian perjanjian ini dibuat rangkap dua bermaterai cukup, masing-masing mempunyai kekuatan hukum yang sama.", { indent: true }),
    ],
  },
  {
    id: "penagihan", name: "Surat Penagihan", cat: "Bisnis", desc: "Pengingat pembayaran dengan tabel tagihan.",
    fields: [F("perusahaan_tujuan", "Perusahaan tujuan", "CV Sumber Rejeki"), F("up", "Up.", "Bapak/Ibu Bagian Keuangan"), F("tabel", "Rincian tagihan (satu baris `no faktur | tanggal | jumlah`)", "INV-2026-001 | 05 Januari 2026 | Rp 4.500.000\nINV-2026-007 | 18 Januari 2026 | Rp 7.250.000", "textarea"), F("total", "Total tagihan", "Rp 11.750.000"), F("batas", "Batas pembayaran", todayISODate(), "date"), F("rekening", "Rekening pembayaran", "Bank Contoh 123-456-7890 a.n. PT Gamato Kreasi Nusantara"), ...ttdFields("Dewi Lestari", "Manajer Keuangan")],
    patch: { kopEnabled: true, kopStyle: "modern", kopLine: "single", kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", kopColor: "#0f766e", colorAccent: "#0f766e", metaEnabled: true, numberMode: "auto", noKode: "FIN/TGH", perihal: "Pemberitahuan Tagihan Jatuh Tempo", lampiran: "-", addressee: "Yth. {{perusahaan_tujuan}}\nUp. {{up}}\ndi tempat", dateLocation: "top", signers: [newSigner({ heading: "Hormat kami,", role: "{{jabatan_ttd}}", name: "{{nama_ttd}}" })] },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Bersama surat ini kami mengingatkan bahwa terdapat tagihan yang telah jatuh tempo dengan rincian sebagai berikut:", { indent: true }),
      blk("table", "No. Faktur | Tanggal | Jumlah\n{{tabel}}", { header: true }),
      blk("paragraph", "**Total tagihan: {{total}}**", { align: "right" }),
      blk("paragraph", "Mohon pembayaran dapat dilakukan paling lambat **{{batas}}** melalui rekening {{rekening}}. Apabila pembayaran telah dilakukan, mohon abaikan surat ini dan kirimkan bukti transfer kepada kami.", { indent: true }),
      blk("paragraph", CLOSE, { indent: true }),
    ],
  },
  {
    id: "cuti", name: "Surat Permohonan Cuti", cat: "Pribadi & Kerja", desc: "Permohonan cuti pegawai dengan periode & alasan.",
    fields: [F("atasan", "Ditujukan kepada", "Bapak/Ibu Manajer HRD"), F("perusahaan", "Perusahaan", "PT Teknologi Nusantara"), F("nama", "Nama", "Budi Santoso"), F("nip", "NIP / NIK karyawan", "EMP-0123"), F("jabatan_saya", "Jabatan", "Staf Administrasi"), F("jenis_cuti", "Jenis cuti", "Cuti Tahunan", "select", { options: ["Cuti Tahunan", "Cuti Sakit", "Cuti Melahirkan", "Cuti Menikah", "Cuti Penting"] }), F("mulai", "Mulai cuti", todayISODate(), "date"), F("selesai", "Selesai cuti", todayISODate(), "date"), F("lama", "Lama cuti", "5 (lima) hari kerja"), F("alasan", "Alasan", "keperluan keluarga di luar kota", "textarea")],
    patch: { kopEnabled: false, metaEnabled: true, perihal: "Permohonan {{jenis_cuti}}", sifat: "", lampiran: "-", addressee: "Yth. {{atasan}}\n{{perusahaan}}\ndi tempat", dateLocation: "top", signers: [newSigner({ heading: "Hormat saya,", name: "{{nama}}" })] },
    blocks: [
      blk("paragraph", "Dengan hormat,"),
      blk("paragraph", "Saya yang bertanda tangan di bawah ini:"),
      blk("data", "", { labelWidth: 30, rows: [dataRow("Nama", "{{nama}}"), dataRow("NIP/NIK", "{{nip}}"), dataRow("Jabatan", "{{jabatan_saya}}")] }),
      blk("paragraph", "Dengan ini mengajukan permohonan **{{jenis_cuti}}** selama {{lama}}, terhitung mulai tanggal {{mulai}} sampai dengan {{selesai}}, karena {{alasan}}.", { indent: true }),
      blk("paragraph", "Selama saya cuti, pekerjaan akan saya koordinasikan dengan rekan satu tim agar kegiatan operasional tetap berjalan. " + CLOSE_P, { indent: true }),
    ],
  },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Resmi & Instansi", "Bisnis", "Pribadi & Kerja", "Hukum & Perjanjian"];

export const letterTemplateById = (id: string): LetterTemplate => LETTER_TEMPLATES.find((t) => t.id === id) ?? LETTER_TEMPLATES[0];

/** Nilai awal semua isian template. */
export const defaultVars = (t: LetterTemplate): Record<string, string> => Object.fromEntries(t.fields.map((f) => [f.key, f.value]));

const cloneBlocks = (bs: LetterBlock[]): LetterBlock[] => bs.map((b) => ({ ...b, id: b.id + Math.random().toString(36).slice(2, 5), rows: b.rows?.map((r) => ({ ...r, id: r.id + Math.random().toString(36).slice(2, 5) })) }));

/**
 * Terapkan template: isi, isian, pengaturan surat, dan penanda tangan diganti. Identitas kop
 * (nama/alamat/kontak/logo), ukuran kertas, font, margin, dan warna milik pengguna dipertahankan.
 */
export function applyLetterTemplate(base: LetterDoc, id: string, opts: { keepKopIdentity?: boolean } = {}): LetterDoc {
  const t = letterTemplateById(id);
  const fresh = blankLetter();
  const keep = opts.keepKopIdentity ?? true;
  const next: LetterDoc = {
    ...base,
    ...t.patch,
    templateId: t.id,
    blocks: cloneBlocks(t.blocks),
    vars: { ...defaultVars(t), ...(t.patch.vars ?? {}) },
    customVars: base.customVars,
    signers: (t.patch.signers ?? fresh.signers).map((s) => ({ ...s, image: base.signers[0]?.image && s === (t.patch.signers ?? fresh.signers)[0] ? base.signers[0].image : s.image })),
    metaEnabled: t.patch.metaEnabled ?? false,
    kopEnabled: t.patch.kopEnabled ?? false,
    addressee: t.patch.addressee ?? "",
    tembusan: t.patch.tembusan ?? "",
    materai: t.patch.materai ?? false,
    signLayout: t.patch.signLayout ?? "right",
    sifat: t.patch.sifat ?? "",
    lampiran: t.patch.lampiran ?? "",
    perihal: t.patch.perihal ?? "",
    nomor: t.patch.nomor ?? "",
    numberMode: t.patch.numberMode ?? "manual",
    noKode: t.patch.noKode ?? base.noKode,
    dateLocation: t.patch.dateLocation ?? "top",
  };
  // Warna yang berasal dari template sebelumnya (bukan pilihan pengguna) dikembalikan ke bawaan.
  const prev = letterTemplateById(base.templateId).patch;
  if (prev.kopColor !== undefined && base.kopColor === prev.kopColor && t.patch.kopColor === undefined) next.kopColor = fresh.kopColor;
  if (prev.colorAccent !== undefined && base.colorAccent === prev.colorAccent && t.patch.colorAccent === undefined) next.colorAccent = fresh.colorAccent;
  if (keep) {
    // Nama instansi hanya dipertahankan bila pengguna sudah mengubahnya dari bawaan.
    const baseDefault = fresh.kopName;
    if (base.kopName && base.kopName !== baseDefault && base.kopName !== "PT GAMATO KREASI NUSANTARA") {
      next.kopName = base.kopName;
      next.kopLine1 = base.kopLine1;
      next.kopAddress = base.kopAddress;
      next.kopContact = base.kopContact;
    } else {
      next.kopAddress = base.kopAddress;
      next.kopContact = base.kopContact;
    }
    next.kopLogo = base.kopLogo;
  }
  return next;
}
