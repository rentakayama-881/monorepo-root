import Link from "next/link";
import {
  ScaleIcon,
  UserIcon,
  UsersIcon,
  DocumentIcon,
  ShieldIcon,
  LockIcon,
  FileTextIcon,
  WarningIcon,
  EditIcon,
  TrashIcon,
  ClockIcon,
  MailIcon,
  GlobeIcon,
  CheckIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = { 
  title: "Syarat dan Ketentuan - AIvalid",
  description: "Syarat dan ketentuan penggunaan platform AIvalid serta pedoman komunitas"
};

// Section card with icon header - compact
function Section({ number, title, icon: Icon, children, note }) {
  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/50/30 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>Pasal {number} — {title}</span>
        </h2>
      </div>
      <div className="p-4 text-[13px] leading-relaxed">
        {children}
        {note && (
          <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-2">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}

// Numbered list item with icon - compact
function NumberedItem({ number, children, icon: Icon }) {
  return (
    <li className="flex items-start gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[10px] font-semibold text-foreground">
        {number}
      </span>
      <span className="pt-0.5 text-[13px]">{children}</span>
    </li>
  );
}

// Definition item
function DefinitionItem({ term, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        <CheckIcon className="h-4 w-4" />
      </span>
      <span><strong className="text-foreground">{term}</strong> {children}</span>
    </li>
  );
}

// Sub-list item with warning icon
function ProhibitedItem({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-destructive">
        <WarningIcon className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">Syarat dan Ketentuan</h1>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon className="h-3 w-3" />
          Terakhir diperbarui: 3 Januari 2026
        </p>
      </div>

      <article>
        {/* Intro */}
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dengan mengakses dan menggunakan platform AIvalid (<Link href="/" className="font-medium text-foreground hover:underline">www.aivalid.id</Link>), 
            Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat dengan syarat dan ketentuan ini. 
            Dokumen ini merupakan perjanjian yang sah secara hukum antara Anda ("Pengguna") dan PT AIvalid Utility Stack ("Kami").
          </p>
        </div>

        {/* Pasal 1 - Definisi */}
        <Section number="1" title="Definisi" icon={DocumentIcon}>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <DefinitionItem term="Platform">adalah situs web AIvalid beserta seluruh layanan yang disediakan.</DefinitionItem>
            <DefinitionItem term="Pengguna">adalah setiap individu yang mengakses atau menggunakan Platform.</DefinitionItem>
            <DefinitionItem term="Konten">adalah segala informasi, teks, gambar, atau materi lain yang diunggah ke Platform.</DefinitionItem>
            <DefinitionItem term="Escrow">adalah sistem penjaminan dana yang dikelola Platform untuk keamanan transaksi.</DefinitionItem>
            <DefinitionItem term="Lencana">adalah penghargaan digital yang diberikan kepada Pengguna berdasarkan kontribusi.</DefinitionItem>
          </ul>
        </Section>

        {/* Pasal 2 - Pendaftaran dan Akun */}
        <Section number="2" title="Pendaftaran dan Akun" icon={UserIcon} note="Dasar hukum: Pasal 26 ayat (1) UU No. 19 Tahun 2016 tentang Perubahan UU ITE">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Pengguna wajib berusia minimal 17 (tujuh belas) tahun atau didampingi orang tua/wali untuk mendaftar.</NumberedItem>
            <NumberedItem number={2}>Pengguna wajib memberikan informasi yang akurat dan terkini saat pendaftaran.</NumberedItem>
            <NumberedItem number={3}>Setiap Pengguna hanya diperbolehkan memiliki satu akun aktif.</NumberedItem>
            <NumberedItem number={4}>Pengguna bertanggung jawab penuh atas keamanan kredensial akun (kata sandi, passkey, kode 2FA).</NumberedItem>
            <NumberedItem number={5}>Pengguna wajib segera melaporkan jika terjadi akses tidak sah terhadap akunnya.</NumberedItem>
            <NumberedItem number={6}>Nama pengguna tidak boleh mengandung kata-kata kasar, menyinggung, atau menyerupai nama resmi pihak lain.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 3 - Konten dan Perilaku */}
        <Section number="3" title="Konten dan Perilaku" icon={FileTextIcon} note="Dasar hukum: Pasal 27-29 UU No. 11 Tahun 2008 jo. UU No. 19 Tahun 2016 tentang ITE">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Pengguna dilarang mengunggah konten yang melanggar hukum Republik Indonesia.</NumberedItem>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-semibold text-foreground">2</span>
              <div className="pt-0.5">
                <span>Konten yang dilarang meliputi namun tidak terbatas pada:</span>
                <ul className="mt-3 space-y-2 ml-1">
                  <ProhibitedItem>Pornografi, terutama yang melibatkan anak di bawah umur</ProhibitedItem>
                  <ProhibitedItem>Ujaran kebencian berbasis SARA (Suku, Agama, Ras, Antargolongan)</ProhibitedItem>
                  <ProhibitedItem>Ancaman kekerasan atau terorisme</ProhibitedItem>
                  <ProhibitedItem>Penipuan dan pemerasan</ProhibitedItem>
                  <ProhibitedItem>Pelanggaran hak kekayaan intelektual</ProhibitedItem>
                  <ProhibitedItem>Data pribadi pihak lain tanpa persetujuan (doxing)</ProhibitedItem>
                </ul>
              </div>
            </li>
            <NumberedItem number={3}>Diskusi teknis tentang keamanan siber diperbolehkan untuk tujuan edukasi dengan batasan tidak merugikan pihak nyata.</NumberedItem>
            <NumberedItem number={4}>Kritik konstruktif diperbolehkan; serangan personal dilarang.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 4 - Transaksi dan Escrow */}
        <Section number="4" title="Transaksi dan Escrow" icon={ShieldIcon} note="Dasar hukum: Pasal 17 PP No. 71 Tahun 2019 tentang PSTE; UU No. 8 Tahun 1999 tentang Perlindungan Konsumen">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Platform menyediakan sistem escrow untuk memfasilitasi transaksi antar Pengguna.</NumberedItem>
            <NumberedItem number={2}>Dana pembeli akan ditahan oleh Platform hingga kedua belah pihak mengkonfirmasi penyelesaian transaksi.</NumberedItem>
            <NumberedItem number={3}>Penjual wajib menyerahkan produk/jasa sesuai deskripsi yang tercantum.</NumberedItem>
            <NumberedItem number={4}>Pembeli memiliki waktu yang ditentukan untuk melakukan inspeksi dan mengajukan klaim jika ada ketidaksesuaian.</NumberedItem>
            <NumberedItem number={5}>Platform berhak memotong biaya layanan dari setiap transaksi sesuai ketentuan yang berlaku.</NumberedItem>
            <NumberedItem number={6}>Sengketa transaksi akan diselesaikan melalui mekanisme arbitrase internal Platform.</NumberedItem>
            <NumberedItem number={7}>Keputusan arbitrase bersifat final dan mengikat kedua belah pihak.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 5 - Hak Kekayaan Intelektual */}
        <Section number="5" title="Hak Kekayaan Intelektual" icon={DocumentIcon} note="Dasar hukum: UU No. 28 Tahun 2014 tentang Hak Cipta; UU No. 20 Tahun 2016 tentang Merek dan Indikasi Geografis">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Pengguna mempertahankan hak atas konten yang diunggah ke Platform.</NumberedItem>
            <NumberedItem number={2}>Dengan mengunggah konten, Pengguna memberikan lisensi non-eksklusif kepada Platform untuk menampilkan konten tersebut.</NumberedItem>
            <NumberedItem number={3}>Platform berhak menghapus konten yang diduga melanggar hak kekayaan intelektual pihak lain.</NumberedItem>
            <NumberedItem number={4}>Merek dagang "AIvalid" dan logo terkait adalah milik PT AIvalid Utility Stack.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 6 - Privasi dan Data Pribadi */}
        <Section number="6" title="Privasi dan Data Pribadi" icon={LockIcon} note="Dasar hukum: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Platform mengumpulkan dan memproses data pribadi sesuai dengan Kebijakan Privasi yang merupakan bagian tidak terpisahkan dari Syarat dan Ketentuan ini.</NumberedItem>
            <NumberedItem number={2}>Pengguna menyetujui pengumpulan data yang diperlukan untuk operasional Platform.</NumberedItem>
            <NumberedItem number={3}>Platform tidak akan menjual data pribadi Pengguna kepada pihak ketiga.</NumberedItem>
            <NumberedItem number={4}>Pengguna berhak mengakses, memperbaiki, dan menghapus data pribadinya.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 7 - Sanksi Pelanggaran */}
        <Section number="7" title="Sanksi Pelanggaran" icon={WarningIcon}>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}><strong className="text-foreground">Teguran:</strong> Pelanggaran ringan akan dikenai peringatan tertulis.</NumberedItem>
            <NumberedItem number={2}><strong className="text-foreground">Pembatasan fitur:</strong> Pelanggaran berulang dapat mengakibatkan pembatasan akses fitur tertentu.</NumberedItem>
            <NumberedItem number={3}><strong className="text-foreground">Penangguhan sementara:</strong> Pelanggaran serius dapat mengakibatkan penangguhan akun sementara.</NumberedItem>
            <NumberedItem number={4}><strong className="text-foreground">Pemutusan permanen:</strong> Pelanggaran berat akan mengakibatkan pemutusan akun secara permanen tanpa pengembalian dana.</NumberedItem>
            <NumberedItem number={5}>Platform berhak melaporkan pelanggaran pidana kepada pihak berwajib.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 8 - Batasan Tanggung Jawab */}
        <Section number="8" title="Batasan Tanggung Jawab" icon={ShieldIcon}>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Platform disediakan "sebagaimana adanya" tanpa jaminan apapun.</NumberedItem>
            <NumberedItem number={2}>Platform tidak bertanggung jawab atas kerugian yang timbul dari penggunaan Platform.</NumberedItem>
            <NumberedItem number={3}>Platform tidak bertanggung jawab atas konten yang diunggah oleh Pengguna.</NumberedItem>
            <NumberedItem number={4}>Platform tidak menjamin ketersediaan layanan tanpa gangguan.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 9 - Perubahan Ketentuan */}
        <Section number="9" title="Perubahan Ketentuan" icon={EditIcon}>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Platform berhak mengubah Syarat dan Ketentuan ini sewaktu-waktu.</NumberedItem>
            <NumberedItem number={2}>Perubahan akan diberitahukan melalui Platform atau email terdaftar.</NumberedItem>
            <NumberedItem number={3}>Penggunaan Platform setelah perubahan berlaku dianggap sebagai persetujuan atas perubahan tersebut.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 10 - Hukum yang Berlaku */}
        <Section number="10" title="Hukum yang Berlaku" icon={ScaleIcon}>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <NumberedItem number={1}>Syarat dan Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia.</NumberedItem>
            <NumberedItem number={2}>Segala sengketa yang timbul akan diselesaikan melalui musyawarah untuk mufakat.</NumberedItem>
            <NumberedItem number={3}>Apabila musyawarah tidak mencapai kesepakatan, sengketa akan diselesaikan melalui Pengadilan Negeri Jakarta Selatan.</NumberedItem>
          </ol>
        </Section>

        {/* Contact */}
        <section className="rounded-lg border border-border bg-gradient-to-br from-muted/50 to-card p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-foreground">
              <MailIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Kontak</h2>
              <p className="text-sm text-muted-foreground">
                Untuk pertanyaan terkait Syarat dan Ketentuan ini, silakan hubungi:{" "}
                <a href="mailto:info@aivalid.id" className="font-medium text-foreground hover:underline">
                  info@aivalid.id
                </a>
              </p>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
