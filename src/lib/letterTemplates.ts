// Template Surat Generator. Setiap template: isian cepat (fields) + isi surat (blocks)
// + pengaturan surat/tanda tangan (patch). Teks memakai {{variabel}} yang diganti saat render.

import { blankLetter, blk, dataRow, newSigner, type LetterBlock, type LetterDoc, type TemplateField } from "@/lib/letterTypes";
import { todayISODate } from "@/lib/dateFormat";
import { tr } from "@/i18n";

import { localizeDeep } from "@/i18n/tokens";
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

const CLOSE = tr("Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.");
const CLOSE_P = tr("Demikian surat ini saya sampaikan. Atas perhatian dan pertimbangan Bapak/Ibu, saya ucapkan terima kasih.");

const ttdFields = (nama: string, jabatan: string, nip = ""): TemplateField[] => [
  F("nama_ttd", tr("Nama penanda tangan"), nama),
  F("jabatan_ttd", tr("Jabatan penanda tangan"), jabatan),
  ...(nip !== null ? [F("nip_ttd", tr("NIP / NIK (opsional)"), nip)] : []),
];

const idBlock = (): LetterBlock => blk("data", "", { labelWidth: 38, rows: [
  dataRow(tr("Nama"), tr("{{nama}}")), dataRow(tr("Tempat/Tgl. Lahir"), "{{ttl}}"), dataRow(tr("Pekerjaan"), tr("{{pekerjaan}}")), dataRow(tr("Alamat"), tr("{{alamat}}")),
] });

const personFields = (): TemplateField[] => [
  F("nama", tr("Nama lengkap"), tr("Budi Santoso")),
  F("ttl", tr("Tempat/tanggal lahir"), tr("Bandung, 14 Mei 1995")),
  F("pekerjaan", tr("Pekerjaan"), tr("Karyawan Swasta")),
  F("alamat", tr("Alamat"), tr("Jl. Melati No. 12, Kelurahan Sukamaju, Bandung"), "textarea"),
];

const kopOn: Partial<LetterDoc> = { kopEnabled: true, kopStyle: "klasik", kopLine: "double" };

const RAW_TEMPLATES: LetterTemplate[] = [
  {
    id: "kosong", name: tr("Kosong"), cat: "Pribadi & Kerja", desc: tr("Mulai dari lembar kosong, susun sendiri blok isinya."),
    fields: [], patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "top" },
    blocks: [blk("paragraph", tr("Tulis isi surat di sini…"), { indent: true })],
  },
  {
    id: "dinas", name: tr("Surat Dinas Resmi"), cat: "Resmi & Instansi", desc: tr("Kop instansi, nomor otomatis, perihal, dan penutup baku."),
    fields: [
      F("tujuan", tr("Ditujukan kepada"), tr("Kepala Sekolah SMP Negeri 1 Contoh")),
      F("tempat", tr("Tempat"), tr("Tempat")),
      F("isi_utama", tr("Isi pembuka"), tr("Sehubungan dengan pelaksanaan program peningkatan mutu pendidikan tahun 2026, bersama ini kami mengundang Bapak/Ibu untuk menghadiri rapat koordinasi yang akan dilaksanakan pada:"), "textarea"),
      F("hari_tanggal", tr("Hari/tanggal kegiatan"), todayISODate(), "date"),
      F("waktu", tr("Waktu"), tr("09.00 WIB – selesai")),
      F("lokasi", tr("Tempat kegiatan"), tr("Aula Dinas Pendidikan")),
      ...ttdFields(tr("Dr. Ahmad Fauzi, M.Pd."), tr("Kepala Dinas Pendidikan"), "197001011995031001"),
    ],
    patch: { ...kopOn, kopLine1: "PEMERINTAH KOTA CONTOH", kopName: "DINAS PENDIDIKAN", metaEnabled: true, numberMode: "auto", noKode: "DISDIK", sifat: tr("Penting"), lampiran: "-", perihal: tr("Undangan Rapat Koordinasi"), addressee: tr("Yth. {{tujuan}}\ndi {{tempat}}"), dateLocation: "top", dateAlign: "right", signLayout: "right", tembusan: tr("Wali Kota Contoh (sebagai laporan)\nArsip"),
      signers: [newSigner({ heading: tr("Hormat kami,"), role: "{{jabatan_ttd}}", name: tr("{{nama_ttd}}"), idLabel: "NIP.", idValue: "{{nip_ttd}}" })] },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("{{isi_utama}}"), { indent: true }),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Hari/Tanggal"), tr("{{hari}}, {{hari_tanggal}}")), dataRow(tr("Waktu"), tr("{{waktu}}")), dataRow(tr("Tempat"), tr("{{lokasi}}"))] }),
      blk("paragraph", tr("Mengingat pentingnya acara tersebut, kami mohon kehadiran Bapak/Ibu tepat waktu. ") + CLOSE, { indent: true }),
    ],
  },
  {
    id: "bisnis", name: tr("Surat Penawaran Bisnis"), cat: "Bisnis", desc: tr("Penawaran produk/jasa lengkap dengan harga & keunggulan."),
    fields: [
      F("perusahaan_tujuan", tr("Perusahaan tujuan"), tr("PT Maju Bersama")),
      F("up", tr("Up. (untuk perhatian)"), tr("Bapak Rudi Hartono, Manajer Pengadaan")),
      F("produk", tr("Produk / jasa"), tr("Paket Layanan Digital Marketing")),
      F("harga", tr("Harga penawaran"), tr("Rp 12.500.000 per bulan")),
      F("keunggulan", tr("Keunggulan (satu baris satu butir)"), tr("Tim berpengalaman lebih dari 8 tahun\nLaporan kinerja mingguan transparan\nGaransi revisi tanpa biaya tambahan\nDukungan pelanggan 24/7"), "textarea"),
      F("berlaku_sampai", tr("Penawaran berlaku sampai"), todayISODate(), "date"),
      ...ttdFields(tr("Dewi Lestari"), tr("Direktur Pemasaran")),
    ],
    patch: { kopEnabled: true, kopStyle: "samping", kopLine: "single", kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", kopColor: "#1e3a8a", metaEnabled: true, numberMode: "auto", noKode: "GKN/PNW", lampiran: tr("1 (satu) berkas"), perihal: tr("Penawaran {{produk}}"), addressee: tr("Kepada Yth.\n{{perusahaan_tujuan}}\nUp. {{up}}\ndi tempat"), signers: [newSigner({ heading: tr("Hormat kami,"), role: "{{jabatan_ttd}}", name: tr("{{nama_ttd}}") })] },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Terima kasih atas kesempatan yang diberikan kepada kami. Melalui surat ini, kami mengajukan penawaran **{{produk}}** untuk {{perusahaan_tujuan}} dengan keunggulan sebagai berikut:"), { indent: true }),
      blk("numbered", "{{keunggulan}}", { numStyle: "1." }),
      blk("data", "", { labelWidth: 40, rows: [dataRow(tr("Produk / jasa"), tr("{{produk}}")), dataRow(tr("Harga"), tr("{{harga}}")), dataRow(tr("Masa berlaku"), tr("s/d {{berlaku_sampai}}"))] }),
      blk("paragraph", tr("Kami siap mendiskusikan rincian lebih lanjut sesuai kebutuhan Bapak/Ibu. ") + CLOSE, { indent: true }),
    ],
  },
  {
    id: "lamaran", name: tr("Surat Lamaran Kerja"), cat: "Pribadi & Kerja", desc: tr("Lamaran pekerjaan lengkap dengan data diri & daftar lampiran."),
    fields: [
      F("perusahaan", tr("Perusahaan tujuan"), tr("PT Teknologi Nusantara")),
      F("alamat_perusahaan", tr("Alamat perusahaan"), tr("Jl. Sudirman No. 45, Jakarta")),
      F("posisi", tr("Posisi dilamar"), tr("Staf Administrasi")),
      F("sumber", tr("Sumber informasi lowongan"), tr("situs karier perusahaan")),
      ...personFields(),
      F("pendidikan", tr("Pendidikan terakhir"), tr("S1 Manajemen, Universitas Contoh")),
      F("telepon", tr("Telepon"), "0812-3456-7890"),
      F("email", tr("Email"), "budi.santoso@email.com"),
      F("lampiran_list", tr("Daftar lampiran (satu baris satu butir)"), tr("Curriculum Vitae\nFotokopi KTP\nFotokopi ijazah & transkrip nilai\nPas foto 3×4 terbaru\nSertifikat pendukung"), "textarea"),
    ],
    patch: { kopEnabled: false, metaEnabled: true, numberMode: "manual", nomor: "", sifat: "", lampiran: tr("{{jumlah_lampiran}}"), perihal: tr("Lamaran Pekerjaan"), addressee: tr("Yth. Bapak/Ibu Pimpinan / HRD\n{{perusahaan}}\n{{alamat_perusahaan}}"), dateLocation: "top", dateAlign: "right", signers: [newSigner({ heading: tr("Hormat saya,"), name: tr("{{nama}}") })], signGap: 24,
      vars: { jumlah_lampiran: tr("5 (lima) berkas") } },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Berdasarkan informasi yang saya peroleh dari {{sumber}}, bahwa perusahaan Bapak/Ibu membutuhkan tenaga kerja untuk posisi **{{posisi}}**, maka saya yang bertanda tangan di bawah ini:"), { indent: true }),
      blk("data", "", { labelWidth: 38, rows: [dataRow(tr("Nama"), tr("{{nama}}")), dataRow(tr("Tempat/Tgl. Lahir"), "{{ttl}}"), dataRow(tr("Pendidikan"), tr("{{pendidikan}}")), dataRow(tr("Alamat"), tr("{{alamat}}")), dataRow(tr("Telepon"), tr("{{telepon}}")), dataRow(tr("Email"), tr("{{email}}"))] }),
      blk("paragraph", tr("bermaksud mengajukan lamaran untuk bergabung dengan {{perusahaan}}. Saya memiliki motivasi tinggi, mampu bekerja dalam tim maupun mandiri, serta siap belajar dan ditempatkan sesuai kebutuhan perusahaan.")),
      blk("paragraph", tr("Sebagai bahan pertimbangan, bersama surat ini saya lampirkan:"), { indent: true }),
      blk("numbered", tr("{{lampiran_list}}")),
      blk("paragraph", CLOSE_P, { indent: true }),
    ],
  },
  {
    id: "resign", name: tr("Surat Pengunduran Diri"), cat: "Pribadi & Kerja", desc: tr("Surat resign sopan dengan tanggal efektif."),
    fields: [
      F("atasan", tr("Ditujukan kepada"), tr("Bapak/Ibu Pimpinan")),
      F("perusahaan", tr("Perusahaan"), tr("PT Teknologi Nusantara")),
      F("nama", tr("Nama"), tr("Budi Santoso")),
      F("jabatan_saya", tr("Jabatan"), tr("Staf Administrasi")),
      F("divisi", tr("Divisi / bagian"), tr("Umum")),
      F("tanggal_efektif", tr("Tanggal efektif berhenti"), todayISODate(), "date"),
      F("alasan", tr("Alasan"), tr("ingin mengembangkan karier di bidang lain"), "textarea"),
    ],
    patch: { kopEnabled: false, metaEnabled: true, perihal: tr("Pengunduran Diri"), lampiran: "", sifat: "", addressee: tr("Yth. {{atasan}}\n{{perusahaan}}\ndi tempat"), dateLocation: "top", signers: [newSigner({ heading: tr("Hormat saya,"), name: tr("{{nama}}") })], signGap: 24 },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 30, rows: [dataRow(tr("Nama"), tr("{{nama}}")), dataRow(tr("Jabatan"), "{{jabatan_saya}}"), dataRow(tr("Divisi"), "{{divisi}}")] }),
      blk("paragraph", tr("Dengan ini mengajukan pengunduran diri dari {{perusahaan}}, efektif per tanggal **{{tanggal_efektif}}**, karena {{alasan}}."), { indent: true }),
      blk("paragraph", tr("Saya mengucapkan terima kasih atas kesempatan, bimbingan, dan pengalaman berharga selama bekerja di perusahaan ini. Saya bersedia menyelesaikan seluruh tanggung jawab dan serah terima pekerjaan hingga tanggal efektif tersebut."), { indent: true }),
      blk("paragraph", tr("Mohon maaf atas segala kekurangan selama saya bekerja. ") + CLOSE_P, { indent: true }),
    ],
  },
  {
    id: "izin", name: tr("Surat Izin Tidak Masuk"), cat: "Pribadi & Kerja", desc: tr("Izin sekolah/kerja — singkat dan rapi."),
    fields: [
      F("tujuan", tr("Ditujukan kepada"), tr("Bapak/Ibu Wali Kelas VII-A")),
      F("lembaga", tr("Sekolah / kantor"), tr("SMP Negeri 1 Contoh")),
      F("nama", tr("Nama yang izin"), tr("Andi Pratama")),
      F("kelas", tr("Kelas / jabatan"), "VII-A"),
      F("hari_izin", tr("Hari / tanggal izin"), tr("Senin, 12 Januari 2026")),
      F("alasan", tr("Alasan"), tr("sakit demam sehingga perlu beristirahat di rumah"), "textarea"),
      F("nama_ttd", tr("Nama penanda tangan"), tr("Siti Rahma")),
      F("hubungan", tr("Hubungan (mis. Orang tua/Wali)"), tr("Orang tua/Wali")),
    ],
    patch: { kopEnabled: false, metaEnabled: false, addressee: tr("Yth. {{tujuan}}\n{{lembaga}}\ndi tempat"), dateLocation: "top", signers: [newSigner({ heading: tr("{{hubungan}},"), name: tr("{{nama_ttd}}") })], signGap: 22 },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini, {{hubungan}} dari:")),
      blk("data", "", { labelWidth: 30, rows: [dataRow(tr("Nama"), tr("{{nama}}")), dataRow("Kelas/Jabatan", "{{kelas}}")] }),
      blk("paragraph", tr("memberitahukan bahwa yang bersangkutan tidak dapat mengikuti kegiatan di {{lembaga}} pada hari {{hari_izin}} karena {{alasan}}."), { indent: true }),
      blk("paragraph", tr("Demikian surat izin ini disampaikan. Atas pengertian Bapak/Ibu, kami ucapkan terima kasih."), { indent: true }),
    ],
  },
  {
    id: "keterangan", name: tr("Surat Keterangan"), cat: "Resmi & Instansi", desc: tr("Surat keterangan umum dengan judul bernomor."),
    fields: [
      F("pejabat", tr("Nama pejabat"), tr("Hj. Rahmawati, S.Sos.")), F("jabatan_pejabat", tr("Jabatan pejabat"), tr("Kepala Desa Sukamaju")),
      ...personFields(),
      F("keterangan", tr("Isi keterangan"), tr("adalah benar warga yang berdomisili di wilayah Desa Sukamaju dan berkelakuan baik selama tinggal di wilayah kami."), "textarea"),
      F("keperluan", tr("Keperluan"), "melengkapi persyaratan administrasi"),
      F("nama_ttd", tr("Nama penanda tangan"), tr("Hj. Rahmawati, S.Sos.")), F("jabatan_ttd", tr("Jabatan penanda tangan"), tr("Kepala Desa Sukamaju")),
    ],
    patch: { ...kopOn, kopLine1: "PEMERINTAH KABUPATEN CONTOH", kopName: "DESA SUKAMAJU", numberMode: "auto", noKode: "SK/DS", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: tr("{{jabatan_ttd}},"), role: "", name: tr("{{nama_ttd}}") })], signGap: 24 },
    blocks: [
      blk("heading", "SURAT KETERANGAN", { underline: true, sub: tr("Nomor: {{nomor}}") }),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 38, rows: [dataRow(tr("Nama"), "{{pejabat}}"), dataRow(tr("Jabatan"), "{{jabatan_pejabat}}")] }),
      blk("paragraph", tr("Menerangkan dengan sesungguhnya bahwa:")),
      idBlock(),
      blk("paragraph", tr("{{keterangan}}"), { indent: true }),
      blk("paragraph", tr("Surat keterangan ini dibuat untuk {{keperluan}} dan dapat dipergunakan sebagaimana mestinya."), { indent: true }),
    ],
  },
  {
    id: "kuasa", name: tr("Surat Kuasa"), cat: "Hukum & Perjanjian", desc: tr("Pemberi & penerima kuasa, dua kolom tanda tangan + materai."),
    fields: [
      F("nama_pemberi", tr("Nama pemberi kuasa"), tr("Budi Santoso")), F("nik_pemberi", tr("NIK pemberi"), "3273011405950001"), F("alamat_pemberi", tr("Alamat pemberi"), tr("Jl. Melati No. 12, Bandung"), "textarea"),
      F("nama_penerima", tr("Nama penerima kuasa"), tr("Agus Wijaya")), F("nik_penerima", tr("NIK penerima"), "3273012003980002"), F("alamat_penerima", tr("Alamat penerima"), tr("Jl. Kenanga No. 8, Bandung"), "textarea"),
      F("keperluan", tr("Untuk keperluan"), tr("mengambil dokumen kendaraan bermotor di kantor Samsat Kota Bandung"), "textarea"),
    ],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "signature", signLayout: "two", materai: true, signGap: 26,
      signers: [newSigner({ heading: tr("Penerima Kuasa,"), name: tr("{{nama_penerima}}") }), newSigner({ heading: tr("Pemberi Kuasa,"), name: tr("{{nama_pemberi}}") })] },
    blocks: [
      blk("heading", "SURAT KUASA", { underline: true }),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 30, rows: [dataRow(tr("Nama"), tr("{{nama_pemberi}}")), dataRow("NIK", "{{nik_pemberi}}"), dataRow(tr("Alamat"), tr("{{alamat_pemberi}}"))] }),
      blk("paragraph", tr("Selanjutnya disebut sebagai **Pemberi Kuasa**. Dengan ini memberikan kuasa penuh kepada:")),
      blk("data", "", { labelWidth: 30, rows: [dataRow(tr("Nama"), tr("{{nama_penerima}}")), dataRow("NIK", tr("{{nik_penerima}}")), dataRow(tr("Alamat"), tr("{{alamat_penerima}}"))] }),
      blk("paragraph", tr("Selanjutnya disebut sebagai **Penerima Kuasa**."), {}),
      blk("paragraph", "------------------------------ KHUSUS ------------------------------", { align: "center", bold: true }),
      blk("paragraph", tr("Untuk dan atas nama Pemberi Kuasa guna {{keperluan}}."), { indent: true }),
      blk("paragraph", tr("Demikian surat kuasa ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya."), { indent: true }),
    ],
  },
  {
    id: "undangan", name: tr("Surat Undangan"), cat: "Resmi & Instansi", desc: tr("Undangan rapat/acara dengan hari, waktu, tempat, agenda."),
    fields: [
      F("tujuan", tr("Ditujukan kepada"), tr("Bapak/Ibu Pengurus RW 05")), F("acara", tr("Nama acara"), tr("Rapat Pengurus Bulanan")),
      F("hari_tanggal", tr("Tanggal acara"), todayISODate(), "date"), F("waktu", tr("Waktu"), tr("19.30 WIB – selesai")), F("lokasi", tr("Tempat"), tr("Balai Warga RW 05")), F("agenda", tr("Agenda"), tr("Evaluasi kegiatan & rencana kerja bulan depan")),
      ...ttdFields(tr("H. Sutrisno"), tr("Ketua RW 05")),
    ],
    patch: { ...kopOn, kopLine1: "", kopName: "PENGURUS RW 05 KELURAHAN CONTOH", kopLine: "single", metaEnabled: true, numberMode: "auto", noKode: "UND/RW05", lampiran: "-", perihal: tr("Undangan {{acara}}"), addressee: tr("Yth. {{tujuan}}\ndi tempat"), dateLocation: "top", signers: [newSigner({ heading: tr("Hormat kami,"), role: "{{jabatan_ttd}}", name: tr("{{nama_ttd}}") })] },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Sehubungan dengan akan diselenggarakannya **{{acara}}**, kami mengundang Bapak/Ibu untuk hadir pada:"), { indent: true }),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Hari/Tanggal"), tr("{{hari}}, {{hari_tanggal}}")), dataRow(tr("Waktu"), tr("{{waktu}}")), dataRow(tr("Tempat"), tr("{{lokasi}}")), dataRow(tr("Agenda"), "{{agenda}}")] }),
      blk("paragraph", tr("Mengingat pentingnya acara tersebut, kehadiran Bapak/Ibu sangat kami harapkan. ") + CLOSE, { indent: true }),
    ],
  },
  {
    id: "pernyataan", name: tr("Surat Pernyataan"), cat: "Hukum & Perjanjian", desc: tr("Pernyataan bermaterai dengan data diri pembuat."),
    fields: [...personFields(), F("isi_pernyataan", tr("Isi pernyataan"), tr("seluruh data dan dokumen yang saya serahkan adalah benar dan sah, serta saya bersedia menerima sanksi sesuai ketentuan yang berlaku apabila di kemudian hari terbukti tidak benar."), "textarea")],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "signature", materai: true, signGap: 26, signers: [newSigner({ heading: tr("Yang membuat pernyataan,"), name: tr("{{nama}}") })] },
    blocks: [
      blk("heading", "SURAT PERNYATAAN", { underline: true }),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini:")),
      idBlock(),
      blk("paragraph", tr("Dengan ini menyatakan dengan sebenar-benarnya bahwa {{isi_pernyataan}}"), { indent: true }),
      blk("paragraph", tr("Demikian surat pernyataan ini saya buat dengan sebenarnya, tanpa paksaan dari pihak manapun, dan dapat dipertanggungjawabkan secara hukum."), { indent: true }),
    ],
  },
  {
    id: "permohonan", name: tr("Surat Permohonan"), cat: "Pribadi & Kerja", desc: tr("Permohonan umum (izin, bantuan, keringanan, dll)."),
    fields: [F("tujuan", tr("Ditujukan kepada"), tr("Bapak/Ibu Kepala Dinas Contoh")), F("tempat", tr("Tempat"), tr("Tempat")), ...personFields(), F("hal", tr("Hal yang dimohonkan"), tr("izin penggunaan lapangan untuk kegiatan bakti sosial"), "textarea"), F("alasan", tr("Alasan / latar belakang"), tr("kegiatan ini bertujuan membantu warga terdampak dan melibatkan pemuda setempat"), "textarea")],
    patch: { kopEnabled: false, metaEnabled: true, perihal: tr("Permohonan"), sifat: "", lampiran: "-", addressee: tr("Yth. {{tujuan}}\ndi {{tempat}}"), dateLocation: "top", signers: [newSigner({ heading: tr("Hormat saya,"), name: tr("{{nama}}") })] },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Saya yang bertanda tangan di bawah ini:")),
      idBlock(),
      blk("paragraph", tr("Dengan ini mengajukan permohonan {{hal}}. Adapun alasan pengajuan permohonan ini adalah {{alasan}}."), { indent: true }),
      blk("paragraph", tr("Besar harapan saya agar permohonan ini dapat dikabulkan. ") + CLOSE_P, { indent: true }),
    ],
  },
  {
    id: "edaran", name: tr("Surat Edaran"), cat: "Resmi & Instansi", desc: tr("Pemberitahuan resmi dengan judul 'Tentang' dan poin-poin."),
    fields: [F("tentang", tr("Tentang"), tr("Pelaksanaan Jam Kerja Selama Bulan Ramadan")), F("pembuka", tr("Paragraf pembuka"), tr("Menindaklanjuti kebijakan pimpinan terkait penyesuaian waktu kerja, dengan ini kami sampaikan hal-hal sebagai berikut:"), "textarea"), F("poin", tr("Poin-poin (satu baris satu butir)"), tr("Jam kerja Senin–Kamis pukul 08.00–15.00 WIB\nJam kerja Jumat pukul 08.00–15.30 WIB\nIstirahat pukul 12.00–12.30 WIB\nKetentuan lain tetap mengikuti peraturan yang berlaku"), "textarea"), ...ttdFields(tr("Ir. Hendra Wijaya"), tr("Direktur Utama"))],
    patch: { ...kopOn, kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", numberMode: "auto", noKode: "SE/DIR", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: tr("Direktur Utama,"), role: "", name: tr("{{nama_ttd}}") })], tembusan: tr("Seluruh Kepala Divisi\nArsip") },
    blocks: [
      blk("heading", "SURAT EDARAN", { underline: false, sub: tr("Nomor: {{nomor}}") }),
      blk("paragraph", tr("**Tentang: {{tentang}}**"), { align: "center" }),
      blk("paragraph", tr("{{pembuka}}"), { indent: true }),
      blk("numbered", tr("{{poin}}")),
      blk("paragraph", tr("Demikian surat edaran ini disampaikan untuk dilaksanakan dengan penuh tanggung jawab. Terima kasih."), { indent: true }),
    ],
  },
  {
    id: "tugas", name: tr("Surat Tugas"), cat: "Resmi & Instansi", desc: tr("Penugasan pegawai untuk kegiatan tertentu."),
    fields: [F("pejabat", tr("Nama pemberi tugas"), tr("Ir. Hendra Wijaya")), F("jabatan_pejabat", tr("Jabatan pemberi tugas"), tr("Direktur Utama")), F("penerima", tr("Nama yang ditugaskan"), tr("Budi Santoso")), F("nip_penerima", "NIP / NIK", "198501012010011002"), F("jabatan_penerima", tr("Jabatan yang ditugaskan"), tr("Staf Keuangan")), F("tugas", "Tugas", tr("mengikuti pelatihan peningkatan kompetensi keuangan"), "textarea"), F("hari_tanggal", tr("Tanggal pelaksanaan"), todayISODate(), "date"), F("lokasi", tr("Tempat"), tr("Hotel Contoh, Jakarta")), ...ttdFields(tr("Ir. Hendra Wijaya"), tr("Direktur Utama"))],
    patch: { ...kopOn, kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", numberMode: "auto", noKode: "ST/DIR", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: tr("{{jabatan_ttd}},"), role: "", name: tr("{{nama_ttd}}") })] },
    blocks: [
      blk("heading", "SURAT TUGAS", { underline: true, sub: tr("Nomor: {{nomor}}") }),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Nama"), "{{pejabat}}"), dataRow(tr("Jabatan"), "{{jabatan_pejabat}}")] }),
      blk("paragraph", tr("Dengan ini memberi tugas kepada:")),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Nama"), tr("{{penerima}}")), dataRow("NIP/NIK", tr("{{nip_penerima}}")), dataRow(tr("Jabatan"), tr("{{jabatan_penerima}}"))] }),
      blk("paragraph", tr("Untuk {{tugas}} yang dilaksanakan pada:")),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Hari/Tanggal"), tr("{{hari}}, {{hari_tanggal}}")), dataRow(tr("Tempat"), tr("{{lokasi}}"))] }),
      blk("paragraph", tr("Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan melaporkan hasilnya kepada pemberi tugas."), { indent: true }),
    ],
  },
  {
    id: "rekomendasi", name: tr("Surat Rekomendasi"), cat: "Pribadi & Kerja", desc: tr("Rekomendasi untuk karyawan, mahasiswa, atau siswa."),
    fields: [F("pejabat", tr("Nama pemberi rekomendasi"), tr("Prof. Dr. Siti Aminah, M.Sc.")), F("jabatan_pejabat", tr("Jabatan"), tr("Dosen Pembimbing Akademik")), F("nama", tr("Nama yang direkomendasikan"), tr("Budi Santoso")), F("posisi", "Status/jabatan", tr("Mahasiswa Program Studi Teknik Informatika")), F("tujuan_rek", tr("Tujuan rekomendasi"), "mengajukan beasiswa S2"), F("isi_rekomendasi", tr("Isi rekomendasi"), tr("Selama bimbingan, yang bersangkutan menunjukkan kemampuan akademik yang sangat baik, disiplin, jujur, dan mampu bekerja sama dalam tim. Oleh karena itu, saya memberikan rekomendasi tanpa keraguan."), "textarea"), ...ttdFields(tr("Prof. Dr. Siti Aminah, M.Sc."), tr("Dosen Pembimbing Akademik"))],
    patch: { ...kopOn, kopName: "UNIVERSITAS CONTOH", kopLine1: "FAKULTAS TEKNIK", numberMode: "auto", noKode: "REK/FT", metaEnabled: false, addressee: "", dateLocation: "signature", signers: [newSigner({ heading: tr("Hormat saya,"), role: "{{jabatan_ttd}}", name: tr("{{nama_ttd}}") })] },
    blocks: [
      blk("heading", "SURAT REKOMENDASI", { underline: true, sub: tr("Nomor: {{nomor}}") }),
      blk("paragraph", tr("Yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Nama"), "{{pejabat}}"), dataRow(tr("Jabatan"), "{{jabatan_pejabat}}")] }),
      blk("paragraph", tr("Dengan ini memberikan rekomendasi kepada:")),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Nama"), tr("{{nama}}")), dataRow("Status", tr("{{posisi}}"))] }),
      blk("paragraph", tr("untuk {{tujuan_rek}}. {{isi_rekomendasi}}"), { indent: true }),
      blk("paragraph", tr("Demikian surat rekomendasi ini dibuat untuk dipergunakan sebagaimana mestinya."), { indent: true }),
    ],
  },
  {
    id: "peringatan", name: tr("Surat Peringatan (SP)"), cat: "Resmi & Instansi", desc: tr("SP karyawan dengan pelanggaran & konsekuensi."),
    fields: [F("tingkat_sp", tr("Tingkat"), "I", "select", { options: ["I", "II", "III"] }), F("nama", tr("Nama karyawan"), tr("Budi Santoso")), F("nik", tr("NIK / ID karyawan"), "EMP-0123"), F("jabatan_k", tr("Jabatan"), tr("Staf Gudang")), F("pelanggaran", tr("Pelanggaran"), tr("terlambat masuk kerja lebih dari 5 kali dalam bulan Januari 2026 tanpa keterangan yang sah"), "textarea"), F("masa_berlaku", tr("Masa berlaku SP"), tr("3 (tiga) bulan")), ...ttdFields(tr("Dewi Lestari"), tr("Manajer HRD"))],
    patch: { ...kopOn, kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", numberMode: "auto", noKode: "SP/HRD", metaEnabled: false, addressee: "", dateLocation: "signature", materai: false, signLayout: "two", signers: [newSigner({ heading: tr("Karyawan yang bersangkutan,"), name: tr("{{nama}}") }), newSigner({ heading: tr("Hormat kami,"), role: "{{jabatan_ttd}}", name: tr("{{nama_ttd}}") })] },
    blocks: [
      blk("heading", tr("SURAT PERINGATAN {{tingkat_sp}}"), { underline: true, sub: tr("Nomor: {{nomor}}") }),
      blk("paragraph", tr("Surat peringatan ini ditujukan kepada:")),
      blk("data", "", { labelWidth: 34, rows: [dataRow(tr("Nama"), tr("{{nama}}")), dataRow("NIK / ID", "{{nik}}"), dataRow(tr("Jabatan"), "{{jabatan_k}}")] }),
      blk("paragraph", tr("Berdasarkan hasil evaluasi, yang bersangkutan telah melakukan pelanggaran berupa {{pelanggaran}}."), { indent: true }),
      blk("paragraph", tr("Sehubungan dengan hal tersebut, kami menyampaikan:")),
      blk("numbered", tr("Surat peringatan ini berlaku selama {{masa_berlaku}} sejak tanggal diterbitkan.\nKaryawan wajib memperbaiki kinerja dan kedisiplinan.\nApabila pelanggaran terulang, perusahaan akan memberikan sanksi yang lebih berat sesuai peraturan perusahaan.")),
      blk("paragraph", tr("Demikian surat peringatan ini disampaikan untuk diperhatikan dan dilaksanakan sebagaimana mestinya."), { indent: true }),
    ],
  },
  {
    id: "sewa", name: tr("Perjanjian Sewa Menyewa"), cat: "Hukum & Perjanjian", desc: tr("Perjanjian sewa sederhana dengan pasal-pasal & materai."),
    fields: [F("pihak1", tr("Nama pemilik (Pihak Pertama)"), tr("Hj. Rahmawati")), F("nik1", tr("NIK Pihak Pertama"), "3273014507700003"), F("alamat1", tr("Alamat Pihak Pertama"), tr("Jl. Anggrek No. 3, Bandung"), "textarea"), F("pihak2", tr("Nama penyewa (Pihak Kedua)"), tr("Budi Santoso")), F("nik2", tr("NIK Pihak Kedua"), "3273011405950001"), F("alamat2", tr("Alamat Pihak Kedua"), tr("Jl. Melati No. 12, Bandung"), "textarea"), F("objek", tr("Objek sewa"), tr("satu unit rumah tinggal di Jl. Anggrek No. 3, Bandung")), F("lama", tr("Lama sewa"), tr("12 (dua belas) bulan")), F("mulai", tr("Mulai sewa"), todayISODate(), "date"), F("harga", tr("Harga sewa total"), tr("Rp 36.000.000,- (tiga puluh enam juta rupiah)")), F("kota_hukum", tr("Kota penyelesaian sengketa"), tr("Bandung"))],
    patch: { kopEnabled: false, metaEnabled: false, addressee: "", dateLocation: "signature", signLayout: "two", materai: true, signGap: 26, signers: [newSigner({ heading: tr("PIHAK PERTAMA,"), name: tr("{{pihak1}}") }), newSigner({ heading: tr("PIHAK KEDUA,"), name: tr("{{pihak2}}") })] },
    blocks: [
      blk("heading", "SURAT PERJANJIAN SEWA MENYEWA", { underline: true }),
      blk("paragraph", tr("Pada hari ini, {{hari}}, tanggal {{tanggal}}, yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 26, rows: [dataRow(tr("1. Nama"), tr("{{pihak1}}")), dataRow("    NIK", "{{nik1}}"), dataRow(tr("    Alamat"), tr("{{alamat1}}"))] }),
      blk("paragraph", tr("selanjutnya disebut **PIHAK PERTAMA** (pemilik), dan")),
      blk("data", "", { labelWidth: 26, rows: [dataRow(tr("2. Nama"), tr("{{pihak2}}")), dataRow("    NIK", "{{nik2}}"), dataRow(tr("    Alamat"), tr("{{alamat2}}"))] }),
      blk("paragraph", tr("selanjutnya disebut **PIHAK KEDUA** (penyewa). Kedua belah pihak sepakat mengadakan perjanjian sewa menyewa dengan ketentuan sebagai berikut:")),
      blk("heading", tr("Pasal 1"), { sub: tr("Objek Sewa") }),
      blk("paragraph", tr("PIHAK PERTAMA menyewakan kepada PIHAK KEDUA {{objek}}."), { indent: true }),
      blk("heading", tr("Pasal 2"), { sub: tr("Jangka Waktu") }),
      blk("paragraph", tr("Perjanjian ini berlaku selama {{lama}}, terhitung mulai tanggal {{mulai}}."), { indent: true }),
      blk("heading", tr("Pasal 3"), { sub: tr("Harga & Pembayaran") }),
      blk("paragraph", tr("Harga sewa selama jangka waktu tersebut sebesar {{harga}}, yang dibayarkan oleh PIHAK KEDUA kepada PIHAK PERTAMA pada saat perjanjian ini ditandatangani."), { indent: true }),
      blk("heading", tr("Pasal 4"), { sub: tr("Hak & Kewajiban") }),
      blk("numbered", tr("PIHAK KEDUA wajib menjaga dan merawat objek sewa dengan baik.\nPIHAK KEDUA dilarang menyewakan kembali objek sewa kepada pihak lain tanpa izin tertulis PIHAK PERTAMA.\nPIHAK KEDUA wajib mengembalikan objek sewa dalam keadaan baik pada saat jangka waktu berakhir.")),
      blk("heading", tr("Pasal 5"), { sub: tr("Penyelesaian Perselisihan") }),
      blk("paragraph", tr("Apabila terjadi perselisihan, kedua belah pihak sepakat menyelesaikannya secara musyawarah. Jika tidak tercapai mufakat, perselisihan akan diselesaikan melalui Pengadilan Negeri {{kota_hukum}}."), { indent: true }),
      blk("paragraph", tr("Demikian perjanjian ini dibuat rangkap dua bermaterai cukup, masing-masing mempunyai kekuatan hukum yang sama."), { indent: true }),
    ],
  },
  {
    id: "penagihan", name: tr("Surat Penagihan"), cat: "Bisnis", desc: tr("Pengingat pembayaran dengan tabel tagihan."),
    fields: [F("perusahaan_tujuan", tr("Perusahaan tujuan"), tr("CV Sumber Rejeki")), F("up", tr("Up."), tr("Bapak/Ibu Bagian Keuangan")), F("tabel", tr("Rincian tagihan (satu baris `no faktur | tanggal | jumlah`)"), tr("INV-2026-001 | 05 Januari 2026 | Rp 4.500.000\nINV-2026-007 | 18 Januari 2026 | Rp 7.250.000"), "textarea"), F("total", tr("Total tagihan"), tr("Rp 11.750.000")), F("batas", tr("Batas pembayaran"), todayISODate(), "date"), F("rekening", tr("Rekening pembayaran"), tr("Bank Contoh 123-456-7890 a.n. PT Gamato Kreasi Nusantara")), ...ttdFields(tr("Dewi Lestari"), tr("Manajer Keuangan"))],
    patch: { kopEnabled: true, kopStyle: "modern", kopLine: "single", kopName: "PT GAMATO KREASI NUSANTARA", kopLine1: "", kopColor: "#0f766e", colorAccent: "#0f766e", metaEnabled: true, numberMode: "auto", noKode: "FIN/TGH", perihal: tr("Pemberitahuan Tagihan Jatuh Tempo"), lampiran: "-", addressee: tr("Yth. {{perusahaan_tujuan}}\nUp. {{up}}\ndi tempat"), dateLocation: "top", signers: [newSigner({ heading: tr("Hormat kami,"), role: "{{jabatan_ttd}}", name: tr("{{nama_ttd}}") })] },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Bersama surat ini kami mengingatkan bahwa terdapat tagihan yang telah jatuh tempo dengan rincian sebagai berikut:"), { indent: true }),
      blk("table", tr("No. Faktur | Tanggal | Jumlah\n{{tabel}}"), { header: true }),
      blk("paragraph", tr("**Total tagihan: {{total}}**"), { align: "right" }),
      blk("paragraph", tr("Mohon pembayaran dapat dilakukan paling lambat **{{batas}}** melalui rekening {{rekening}}. Apabila pembayaran telah dilakukan, mohon abaikan surat ini dan kirimkan bukti transfer kepada kami."), { indent: true }),
      blk("paragraph", CLOSE, { indent: true }),
    ],
  },
  {
    id: "cuti", name: tr("Surat Permohonan Cuti"), cat: "Pribadi & Kerja", desc: tr("Permohonan cuti pegawai dengan periode & alasan."),
    fields: [F("atasan", tr("Ditujukan kepada"), tr("Bapak/Ibu Manajer HRD")), F("perusahaan", tr("Perusahaan"), tr("PT Teknologi Nusantara")), F("nama", tr("Nama"), tr("Budi Santoso")), F("nip", tr("NIP / NIK karyawan"), "EMP-0123"), F("jabatan_saya", tr("Jabatan"), tr("Staf Administrasi")), F("jenis_cuti", tr("Jenis cuti"), tr("Cuti Tahunan"), "select", { options: [tr("Cuti Tahunan"), tr("Cuti Sakit"), tr("Cuti Melahirkan"), tr("Cuti Menikah"), tr("Cuti Penting")] }), F("mulai", tr("Mulai cuti"), todayISODate(), "date"), F("selesai", tr("Selesai cuti"), todayISODate(), "date"), F("lama", tr("Lama cuti"), tr("5 (lima) hari kerja")), F("alasan", tr("Alasan"), tr("keperluan keluarga di luar kota"), "textarea")],
    patch: { kopEnabled: false, metaEnabled: true, perihal: tr("Permohonan {{jenis_cuti}}"), sifat: "", lampiran: "-", addressee: tr("Yth. {{atasan}}\n{{perusahaan}}\ndi tempat"), dateLocation: "top", signers: [newSigner({ heading: tr("Hormat saya,"), name: tr("{{nama}}") })] },
    blocks: [
      blk("paragraph", tr("Dengan hormat,")),
      blk("paragraph", tr("Saya yang bertanda tangan di bawah ini:")),
      blk("data", "", { labelWidth: 30, rows: [dataRow(tr("Nama"), tr("{{nama}}")), dataRow("NIP/NIK", "{{nip}}"), dataRow(tr("Jabatan"), "{{jabatan_saya}}")] }),
      blk("paragraph", tr("Dengan ini mengajukan permohonan **{{jenis_cuti}}** selama {{lama}}, terhitung mulai tanggal {{mulai}} sampai dengan {{selesai}}, karena {{alasan}}."), { indent: true }),
      blk("paragraph", tr("Selama saya cuti, pekerjaan akan saya koordinasikan dengan rekan satu tim agar kegiatan operasional tetap berjalan. ") + CLOSE_P, { indent: true }),
    ],
  },
];

/** Di mode EN: nama variabel `{{…}}` & kolom isian memakai nama Inggris. */
export const LETTER_TEMPLATES: LetterTemplate[] = localizeDeep(RAW_TEMPLATES);

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
