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
  title: "Syarat dan Ketentuan - AlephDraad",
  description: "Syarat dan ketentuan penggunaan platform AlephDraad serta pedoman komunitas"
};

// Section card with icon header
function Section({ number, title, icon: Icon, children, note }) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-1))] transition-all hover:border-[rgb(var(--muted))]/30">
      <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/50 px-5 py-4">
        <h2 className="flex items-center gap-3 text-base font-semibold text-[rgb(var(--fg))]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
            <Icon className="h-4 w-4" />
          </span>
          <span>Pasal {number} — {title}</span>
        </h2>
      </div>
      <div className="p-5">
        {children}
        {note && (
          <p className="mt-4 text-xs text-[rgb(var(--muted))] border-t border-[rgb(var(--border))] pt-3">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}

// Numbered list item with icon
function NumberedItem({ number, children, icon: Icon }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-xs font-semibold text-[rgb(var(--fg))]">
        {number}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

// Definition item
function DefinitionItem({ term, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[rgb(var(--muted))]">
        <CheckIcon className="h-4 w-4" />
      </span>
      <span><strong className="text-[rgb(var(--fg))]">{term}</strong> {children}</span>
    </li>
  );
}

// Sub-list item with warning icon
function ProhibitedItem({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[rgb(var(--error))]">
        <WarningIcon className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
            <ScaleIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Syarat dan Ketentuan</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[rgb(var(--muted))]">
              <ClockIcon className="h-3.5 w-3.5" />
              Terakhir diperbarui: 3 Januari 2026
            </p>
          </div>
        </div>
      </div>

      <article>
        {/* Intro */}
        <div className="mb-6 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/50 p-5">
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            Dengan mengakses dan menggunakan platform AlephDraad (<a href="https://www.alephdraad.fun" className="font-medium text-[rgb(var(--fg))] hover:underline">www.alephdraad.fun</a>), 
            Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat dengan syarat dan ketentuan ini. 
            Dokumen ini merupakan perjanjian yang sah secara hukum antara Anda ("Pengguna") dan PT AlephDraad Utility Stack ("Kami").
          </p>
        </div>

        {/* Pasal 1 - Definisi */}
        <Section number="1" title="Definisi" icon={DocumentIcon}>
          <ul className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <DefinitionItem term="Platform">adalah situs web AlephDraad beserta seluruh layanan yang disediakan.</DefinitionItem>
            <DefinitionItem term="Pengguna">adalah setiap individu yang mengakses atau menggunakan Platform.</DefinitionItem>
            <DefinitionItem term="Konten">adalah segala informasi, teks, gambar, atau materi lain yang diunggah ke Platform.</DefinitionItem>
            <DefinitionItem term="Escrow">adalah sistem penjaminan dana yang dikelola Platform untuk keamanan transaksi.</DefinitionItem>
            <DefinitionItem term="Lencana">adalah penghargaan digital yang diberikan kepada Pengguna berdasarkan kontribusi.</DefinitionItem>
          </ul>
        </Section>

        {/* Pasal 2 - Pendaftaran dan Akun */}
        <Section number="2" title="Pendaftaran dan Akun" icon={UserIcon} note="Dasar hukum: Pasal 26 ayat (1) UU No. 19 Tahun 2016 tentang Perubahan UU ITE">
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
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
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}>Pengguna dilarang mengunggah konten yang melanggar hukum Republik Indonesia.</NumberedItem>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-xs font-semibold text-[rgb(var(--fg))]">2</span>
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
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
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
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}>Pengguna mempertahankan hak atas konten yang diunggah ke Platform.</NumberedItem>
            <NumberedItem number={2}>Dengan mengunggah konten, Pengguna memberikan lisensi non-eksklusif kepada Platform untuk menampilkan konten tersebut.</NumberedItem>
            <NumberedItem number={3}>Platform berhak menghapus konten yang diduga melanggar hak kekayaan intelektual pihak lain.</NumberedItem>
            <NumberedItem number={4}>Merek dagang "AlephDraad" dan logo terkait adalah milik PT AlephDraad Utility Stack.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 6 - Privasi dan Data Pribadi */}
        <Section number="6" title="Privasi dan Data Pribadi" icon={LockIcon} note="Dasar hukum: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi">
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}>Platform mengumpulkan dan memproses data pribadi sesuai dengan Kebijakan Privasi yang merupakan bagian tidak terpisahkan dari Syarat dan Ketentuan ini.</NumberedItem>
            <NumberedItem number={2}>Pengguna menyetujui pengumpulan data yang diperlukan untuk operasional Platform.</NumberedItem>
            <NumberedItem number={3}>Platform tidak akan menjual data pribadi Pengguna kepada pihak ketiga.</NumberedItem>
            <NumberedItem number={4}>Pengguna berhak mengakses, memperbaiki, dan menghapus data pribadinya.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 7 - Sanksi Pelanggaran */}
        <Section number="7" title="Sanksi Pelanggaran" icon={WarningIcon}>
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}><strong className="text-[rgb(var(--fg))]">Teguran:</strong> Pelanggaran ringan akan dikenai peringatan tertulis.</NumberedItem>
            <NumberedItem number={2}><strong className="text-[rgb(var(--fg))]">Pembatasan fitur:</strong> Pelanggaran berulang dapat mengakibatkan pembatasan akses fitur tertentu.</NumberedItem>
            <NumberedItem number={3}><strong className="text-[rgb(var(--fg))]">Penangguhan sementara:</strong> Pelanggaran serius dapat mengakibatkan penangguhan akun sementara.</NumberedItem>
            <NumberedItem number={4}><strong className="text-[rgb(var(--fg))]">Pemutusan permanen:</strong> Pelanggaran berat akan mengakibatkan pemutusan akun secara permanen tanpa pengembalian dana.</NumberedItem>
            <NumberedItem number={5}>Platform berhak melaporkan pelanggaran pidana kepada pihak berwajib.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 8 - Batasan Tanggung Jawab */}
        <Section number="8" title="Batasan Tanggung Jawab" icon={ShieldIcon}>
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}>Platform disediakan "sebagaimana adanya" tanpa jaminan apapun.</NumberedItem>
            <NumberedItem number={2}>Platform tidak bertanggung jawab atas kerugian yang timbul dari penggunaan Platform.</NumberedItem>
            <NumberedItem number={3}>Platform tidak bertanggung jawab atas konten yang diunggah oleh Pengguna.</NumberedItem>
            <NumberedItem number={4}>Platform tidak menjamin ketersediaan layanan tanpa gangguan.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 9 - Perubahan Ketentuan */}
        <Section number="9" title="Perubahan Ketentuan" icon={EditIcon}>
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}>Platform berhak mengubah Syarat dan Ketentuan ini sewaktu-waktu.</NumberedItem>
            <NumberedItem number={2}>Perubahan akan diberitahukan melalui Platform atau email terdaftar.</NumberedItem>
            <NumberedItem number={3}>Penggunaan Platform setelah perubahan berlaku dianggap sebagai persetujuan atas perubahan tersebut.</NumberedItem>
          </ol>
        </Section>

        {/* Pasal 10 - Hukum yang Berlaku */}
        <Section number="10" title="Hukum yang Berlaku" icon={ScaleIcon}>
          <ol className="space-y-3 text-sm text-[rgb(var(--muted))]">
            <NumberedItem number={1}>Syarat dan Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia.</NumberedItem>
            <NumberedItem number={2}>Segala sengketa yang timbul akan diselesaikan melalui musyawarah untuk mufakat.</NumberedItem>
            <NumberedItem number={3}>Apabila musyawarah tidak mencapai kesepakatan, sengketa akan diselesaikan melalui Pengadilan Negeri Jakarta Selatan.</NumberedItem>
          </ol>
        </Section>

        {/* Contact */}
        <section className="rounded-xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface-2))] to-[rgb(var(--surface-1))] p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
              <MailIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-[rgb(var(--fg))]">Kontak</h2>
              <p className="text-sm text-[rgb(var(--muted))]">
                Untuk pertanyaan terkait Syarat dan Ketentuan ini, silakan hubungi:{" "}
                <a href="mailto:ops@alephdraad.fun" className="font-medium text-[rgb(var(--fg))] hover:underline">
                  ops@alephdraad.fun
                </a>
              </p>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
