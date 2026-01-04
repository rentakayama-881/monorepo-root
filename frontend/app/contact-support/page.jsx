import {
  HelpCircleIcon,
  MailIcon,
  ClockIcon,
  ShieldIcon,
  UserIcon,
  LockIcon,
  AwardIcon,
  WarningIcon,
  TrashIcon,
  CreditCardIcon,
  FileTextIcon,
  UsersIcon,
  InfoIcon,
  CheckIcon,
  ChevronRightIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = { 
  title: "Bantuan - AlephDraad",
  description: "Pusat bantuan dan dukungan pelanggan AlephDraad"
};

// Contact Card
function ContactCard({ icon: Icon, title, children, highlight = false }) {
  return (
    <div className={`rounded-xl border p-5 transition-all hover:border-[rgb(var(--muted))]/50 ${highlight ? 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/30' : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-1))]'}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${highlight ? 'bg-[rgb(var(--surface-2))]' : 'bg-[rgb(var(--surface-2))]'} text-[rgb(var(--fg))]`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-[rgb(var(--fg))]">{title}</span>
      </div>
      {children}
    </div>
  );
}

// FAQ Accordion Item
function FAQItem({ question, children, icon: Icon = HelpCircleIcon }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-1))] transition-all hover:border-[rgb(var(--muted))]/30">
      <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium text-[rgb(var(--fg))]">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] transition-colors group-hover:bg-[rgb(var(--surface-2))]">
            <Icon className="h-4 w-4" />
          </span>
          <span>{question}</span>
        </div>
        <svg className="h-5 w-5 shrink-0 text-[rgb(var(--muted))] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-[rgb(var(--border))] p-5 text-sm text-[rgb(var(--muted))]">
        {children}
      </div>
    </details>
  );
}

// Numbered Step
function Step({ number, title, description }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-xs font-semibold text-[rgb(var(--fg))]">
        {number}
      </span>
      <div className="pt-0.5">
        {title && <strong className="text-[rgb(var(--fg))]">{title}</strong>}
        {title && description && " — "}
        {description}
      </div>
    </li>
  );
}

// List Item with icon
function ListItem({ children, icon: Icon = CheckIcon }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[rgb(var(--muted))]">
        <Icon className="h-4 w-4" />
      </span>
      <span>{children}</span>
    </li>
  );
}

// Guide Link Card
function GuideCard({ href, icon: Icon, title, description }) {
  return (
    <a href={href} className="group flex items-center gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-1))] p-4 transition-all hover:border-[rgb(var(--muted))]/50 hover:shadow-md">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))] transition-colors group-hover:bg-[rgb(var(--surface-2))] group-hover:text-[rgb(var(--fg))]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-[rgb(var(--fg))]">{title}</p>
        <p className="text-xs text-[rgb(var(--muted))]">{description}</p>
      </div>
      <ChevronRightIcon className="h-4 w-4 text-[rgb(var(--muted))] transition-transform group-hover:translate-x-1 group-hover:text-[rgb(var(--fg))]" />
    </a>
  );
}

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
            <HelpCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Pusat Bantuan</h1>
            <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">
              Temukan jawaban atau hubungi tim kami
            </p>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[rgb(var(--fg))]">
          <MailIcon className="h-5 w-5 text-[rgb(var(--muted))]" />
          Hubungi Kami
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ContactCard icon={MailIcon} title="Email" highlight={true}>
            <a href="mailto:help@alephdraad.fun" className="text-sm font-medium text-[rgb(var(--fg))] hover:underline">
              help@alephdraad.fun
            </a>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">Respons dalam 1-2 hari kerja</p>
          </ContactCard>
          <ContactCard icon={ClockIcon} title="Jam Operasional">
            <p className="text-sm text-[rgb(var(--muted))]">Senin - Jumat</p>
            <p className="text-sm font-medium text-[rgb(var(--fg))]">09.00 - 18.00 WIB</p>
          </ContactCard>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[rgb(var(--fg))]">
          <HelpCircleIcon className="h-5 w-5 text-[rgb(var(--muted))]" />
          Pertanyaan Umum (FAQ)
        </h2>
        <div className="space-y-3">
          <FAQItem question="Bagaimana cara mendaftar akun?" icon={UserIcon}>
            <p className="mb-3">Untuk mendaftar akun AlephDraad:</p>
            <ol className="space-y-2.5">
              <Step number={1} description='Klik tombol "Daftar" di pojok kanan atas' />
              <Step number={2} description="Masukkan alamat email yang valid" />
              <Step number={3} description="Buat kata sandi yang kuat (minimal 8 karakter)" />
              <Step number={4} description="Verifikasi email Anda melalui tautan yang dikirim" />
              <Step number={5} description="Lengkapi profil Anda" />
            </ol>
          </FAQItem>

          <FAQItem question="Bagaimana sistem escrow bekerja?" icon={ShieldIcon}>
            <p className="mb-3">Sistem escrow melindungi pembeli dan penjual dalam transaksi:</p>
            <ol className="space-y-2.5">
              <Step number={1} title="Pembeli memulai transaksi" description="Dana ditransfer ke rekening escrow AlephDraad" />
              <Step number={2} title="Penjual menerima notifikasi" description="Penjual mengirimkan produk/jasa sesuai kesepakatan" />
              <Step number={3} title="Pembeli melakukan inspeksi" description="Pembeli memiliki waktu untuk memeriksa produk/jasa" />
              <Step number={4} title="Konfirmasi penyelesaian" description="Jika sesuai, pembeli mengkonfirmasi dan dana diteruskan ke penjual" />
              <Step number={5} title="Penyelesaian sengketa" description="Jika ada masalah, tim arbitrase akan membantu menyelesaikan" />
            </ol>
            <p className="mt-4 rounded-lg bg-[rgb(var(--surface-2))] p-3 text-xs">
              💡 Biaya layanan escrow: <strong className="text-[rgb(var(--fg))]">2.5%</strong> dari nilai transaksi
            </p>
          </FAQItem>

          <FAQItem question="Bagaimana cara mengaktifkan keamanan dua faktor (2FA)?" icon={LockIcon}>
            <p className="mb-3">Untuk mengaktifkan 2FA:</p>
            <ol className="space-y-2.5">
              <Step number={1} description="Buka Pengaturan Akun → Keamanan" />
              <Step number={2} description='"Aktifkan Autentikasi Dua Faktor"' />
              <Step number={3} description="Pindai kode QR dengan aplikasi authenticator (Google Authenticator, Authy, dll)" />
              <Step number={4} description="Masukkan kode verifikasi 6 digit" />
              <Step number={5} description="Simpan kode pemulihan di tempat aman" />
            </ol>
            <p className="mt-4 text-sm">Kami juga mendukung <strong className="text-[rgb(var(--fg))]">Passkey</strong> untuk keamanan yang lebih tinggi.</p>
          </FAQItem>

          <FAQItem question="Bagaimana cara mendapatkan lencana?" icon={AwardIcon}>
            <p className="mb-3">Lencana diberikan berdasarkan kontribusi dan reputasi:</p>
            <ul className="space-y-2.5">
              <ListItem icon={AwardIcon}>
                <strong className="text-[rgb(var(--fg))]">Kontributor Aktif</strong> — Membuat konten berkualitas secara konsisten
              </ListItem>
              <ListItem icon={ShieldIcon}>
                <strong className="text-[rgb(var(--fg))]">Penjual Terpercaya</strong> — Menyelesaikan transaksi dengan rating tinggi
              </ListItem>
              <ListItem icon={CheckIcon}>
                <strong className="text-[rgb(var(--fg))]">Verified</strong> — Identitas telah diverifikasi oleh tim
              </ListItem>
              <ListItem icon={UserIcon}>
                <strong className="text-[rgb(var(--fg))]">Expert</strong> — Memiliki keahlian khusus yang diakui komunitas
              </ListItem>
            </ul>
            <p className="mt-4 text-xs text-[rgb(var(--muted))]">Lencana juga dapat diberikan berdasarkan reputasi dari platform lain yang dapat diverifikasi.</p>
          </FAQItem>

          <FAQItem question="Bagaimana cara melaporkan konten yang melanggar?" icon={WarningIcon}>
            <p className="mb-3">Untuk melaporkan konten yang melanggar:</p>
            <ol className="space-y-2.5">
              <Step number={1} description="Klik ikon titik tiga (⋯) pada konten yang ingin dilaporkan" />
              <Step number={2} description='"Laporkan"' />
              <Step number={3} description="Pilih kategori pelanggaran" />
              <Step number={4} description="Berikan penjelasan tambahan jika diperlukan" />
              <Step number={5} description="Kirim laporan" />
            </ol>
            <p className="mt-4 rounded-lg bg-[rgb(var(--surface-2))] p-3 text-xs">
              ⏱️ Tim moderasi akan meninjau laporan dalam <strong className="text-[rgb(var(--fg))]">24-48 jam</strong>.
            </p>
          </FAQItem>

          <FAQItem question="Bagaimana cara menghapus akun?" icon={TrashIcon}>
            <p className="mb-3">Untuk menghapus akun secara permanen:</p>
            <ol className="space-y-2.5">
              <Step number={1} description="Pastikan tidak ada transaksi yang sedang berjalan" />
              <Step number={2} description="Buka Pengaturan Akun → Akun" />
              <Step number={3} description='Scroll ke bagian "Zona Bahaya"' />
              <Step number={4} description='"Hapus Akun"' />
              <Step number={5} description="Konfirmasi dengan memasukkan kata sandi atau kode 2FA" />
            </ol>
            <p className="mt-4 rounded-lg border border-[rgb(var(--error))]/20 bg-[rgb(var(--error))]/5 p-3 text-xs text-[rgb(var(--error))]">
              ⚠️ Perhatian: Penghapusan akun bersifat permanen dan tidak dapat dibatalkan.
            </p>
          </FAQItem>

          <FAQItem question="Metode pembayaran apa yang didukung?" icon={CreditCardIcon}>
            <p className="mb-3">AlephDraad mendukung berbagai metode pembayaran:</p>
            <ul className="space-y-2.5">
              <ListItem icon={CreditCardIcon}>
                <strong className="text-[rgb(var(--fg))]">Transfer Bank</strong> — BCA, Mandiri, BNI, BRI, dan bank lainnya
              </ListItem>
              <ListItem icon={CreditCardIcon}>
                <strong className="text-[rgb(var(--fg))]">E-Wallet</strong> — OVO, GoPay, DANA, ShopeePay
              </ListItem>
              <ListItem icon={CreditCardIcon}>
                <strong className="text-[rgb(var(--fg))]">QRIS</strong> — Scan QR untuk pembayaran instan
              </ListItem>
              <ListItem icon={CreditCardIcon}>
                <strong className="text-[rgb(var(--fg))]">Virtual Account</strong> — Tersedia untuk semua bank utama
              </ListItem>
            </ul>
            <p className="mt-4 text-xs text-[rgb(var(--muted))]">Pembayaran diproses melalui payment gateway berlisensi OJK.</p>
          </FAQItem>
        </div>
      </section>

      {/* Guidelines */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[rgb(var(--fg))]">
          <FileTextIcon className="h-5 w-5 text-[rgb(var(--muted))]" />
          Panduan Pengguna
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <GuideCard 
            href="/rules-content" 
            icon={FileTextIcon}
            title="Syarat dan Ketentuan"
            description="Aturan penggunaan platform"
          />
          <GuideCard 
            href="/privacy" 
            icon={LockIcon}
            title="Kebijakan Privasi"
            description="Cara kami melindungi data Anda"
          />
          <GuideCard 
            href="/community-guidelines" 
            icon={UsersIcon}
            title="Pedoman Komunitas"
            description="Etika dan perilaku di platform"
          />
          <GuideCard 
            href="/changelog" 
            icon={ClockIcon}
            title="Catatan Perubahan"
            description="Pembaruan dan fitur baru"
          />
        </div>
      </section>

      {/* Tips Box */}
      <section className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/50 p-5">
        <div className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-[rgb(var(--fg))]">Tips untuk respons cepat</p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Sertakan detail lengkap dalam pertanyaan Anda: ID akun, tangkapan layar error, dan langkah-langkah yang sudah dicoba.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
