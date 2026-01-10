import {
  ShieldIcon,
  UserIcon,
  DatabaseIcon,
  ServerIcon,
  GlobeIcon,
  CookieIcon,
  LockIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  DownloadIcon,
  ClockIcon,
  MailIcon,
  CheckIcon,
  SettingsIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = { 
  title: "Kebijakan Privasi - AlephDraad",
  description: "Kebijakan privasi dan perlindungan data pribadi pengguna AlephDraad"
};

// Reusable styled list item with icon
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

// Section card with icon header
function Section({ number, title, icon: Icon, children }) {
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-1))] transition-all hover:border-[rgb(var(--muted))]/30">
      <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/50 px-5 py-4">
        <h2 className="flex items-center gap-3 text-base font-semibold text-[rgb(var(--fg))]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
            <Icon className="h-4 w-4" />
          </span>
          <span>{number}. {title}</span>
        </h2>
      </div>
      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

// Subsection header
function SubSection({ title }) {
  return (
    <h3 className="mb-3 text-sm font-medium text-[rgb(var(--fg))]">{title}</h3>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Kebijakan Privasi</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[rgb(var(--muted))]">
              <ClockIcon className="h-3.5 w-3.5" />
              Terakhir diperbarui: 3 Januari 2026
            </p>
          </div>
        </div>
      </div>

      <article>
        {/* Intro */}
        <div className="mb-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/50 p-5">
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            PT AlephDraad Utility Stack ("Kami") berkomitmen untuk melindungi privasi dan data pribadi Anda. 
            Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi 
            informasi Anda saat menggunakan platform AlephDraad.
          </p>
        </div>

        {/* Data yang Dikumpulkan */}
        <Section number="1" title="Data yang Kami Kumpulkan" icon={DatabaseIcon}>
          <SubSection title="1.1 Data yang Anda Berikan" />
          <ul className="mb-5 space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={UserIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Informasi akun:</strong> nama, alamat email, nama pengguna, kata sandi (terenkripsi)</span>
            </ListItem>
            <ListItem icon={UserIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Informasi profil:</strong> foto profil, bio, tautan media sosial</span>
            </ListItem>
            <ListItem icon={EditIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Konten yang Anda unggah:</strong> thread, komentar, pesan</span>
            </ListItem>
            <ListItem icon={LockIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Informasi transaksi:</strong> untuk keperluan escrow dan pembayaran</span>
            </ListItem>
          </ul>

          <SubSection title="1.2 Data yang Dikumpulkan Otomatis" />
          <ul className="space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={GlobeIcon}>Alamat IP dan informasi perangkat</ListItem>
            <ListItem icon={SettingsIcon}>Jenis browser dan sistem operasi</ListItem>
            <ListItem icon={ClockIcon}>Log aktivitas dan waktu akses</ListItem>
            <ListItem icon={CookieIcon}>Cookie dan teknologi pelacakan serupa</ListItem>
          </ul>
        </Section>

        {/* Penggunaan Data */}
        <Section number="2" title="Penggunaan Data" icon={EyeIcon}>
          <p className="mb-4 text-sm text-[rgb(var(--muted))]">Kami menggunakan data Anda untuk:</p>
          <ul className="space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={ServerIcon}>Menyediakan, mengoperasikan, dan memelihara layanan Platform</ListItem>
            <ListItem icon={LockIcon}>Memproses transaksi dan mengelola escrow</ListItem>
            <ListItem icon={MailIcon}>Mengirimkan notifikasi terkait akun dan transaksi</ListItem>
            <ListItem icon={ShieldIcon}>Mendeteksi dan mencegah penipuan serta aktivitas berbahaya</ListItem>
            <ListItem icon={CheckIcon}>Meningkatkan kualitas layanan berdasarkan analisis penggunaan</ListItem>
            <ListItem icon={CheckIcon}>Mematuhi kewajiban hukum dan regulasi yang berlaku</ListItem>
          </ul>
        </Section>

        {/* Penyimpanan Data */}
        <Section number="3" title="Penyimpanan dan Keamanan Data" icon={ServerIcon}>
          <ul className="space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={GlobeIcon}>Data disimpan di server yang berlokasi di Indonesia dan/atau Singapura</ListItem>
            <ListItem icon={LockIcon}>Enkripsi end-to-end untuk data sensitif (kata sandi, informasi pembayaran)</ListItem>
            <ListItem icon={UserIcon}>Akses data dibatasi hanya untuk personel yang berwenang</ListItem>
            <ListItem icon={ShieldIcon}>Audit keamanan berkala untuk mendeteksi kerentanan</ListItem>
            <ListItem icon={ClockIcon}>Data disimpan selama akun aktif atau sesuai kewajiban hukum</ListItem>
          </ul>
        </Section>

        {/* Pembagian Data */}
        <Section number="4" title="Pembagian Data dengan Pihak Ketiga" icon={GlobeIcon}>
          <p className="mb-4 text-sm text-[rgb(var(--muted))]">Kami tidak menjual data pribadi Anda. Data dapat dibagikan hanya kepada:</p>
          <ul className="space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={LockIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Penyedia layanan pembayaran:</strong> untuk memproses transaksi</span>
            </ListItem>
            <ListItem icon={ServerIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Penyedia infrastruktur:</strong> hosting, CDN, dan layanan cloud</span>
            </ListItem>
            <ListItem icon={ShieldIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Pihak berwenang:</strong> jika diwajibkan oleh hukum atau perintah pengadilan</span>
            </ListItem>
          </ul>
        </Section>

        {/* Hak Pengguna */}
        <Section number="5" title="Hak Anda sebagai Subjek Data" icon={UserIcon}>
          <p className="mb-4 text-sm text-[rgb(var(--muted))]">Sesuai dengan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda memiliki hak untuk:</p>
          <ul className="space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={EyeIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Mengakses</strong> data pribadi yang kami simpan tentang Anda</span>
            </ListItem>
            <ListItem icon={EditIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Memperbaiki</strong> data yang tidak akurat atau tidak lengkap</span>
            </ListItem>
            <ListItem icon={TrashIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Menghapus</strong> data pribadi Anda (dengan batasan tertentu)</span>
            </ListItem>
            <ListItem icon={CheckIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Menarik persetujuan</strong> atas pemrosesan data</span>
            </ListItem>
            <ListItem icon={DownloadIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Memindahkan</strong> data ke platform lain (portabilitas data)</span>
            </ListItem>
            <ListItem icon={ShieldIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Mengajukan keberatan</strong> atas pemrosesan data tertentu</span>
            </ListItem>
          </ul>
        </Section>

        {/* Cookie */}
        <Section number="6" title="Cookie dan Teknologi Pelacakan" icon={CookieIcon}>
          <p className="mb-4 text-sm text-[rgb(var(--muted))]">Kami menggunakan cookie untuk:</p>
          <ul className="mb-4 space-y-2.5 text-sm text-[rgb(var(--muted))]">
            <ListItem icon={SettingsIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Cookie esensial:</strong> diperlukan untuk fungsi dasar Platform</span>
            </ListItem>
            <ListItem icon={LockIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Cookie autentikasi:</strong> menjaga sesi login Anda</span>
            </ListItem>
            <ListItem icon={UserIcon}>
              <span><strong className="text-[rgb(var(--fg))]">Cookie preferensi:</strong> menyimpan pengaturan tampilan</span>
            </ListItem>
          </ul>
          <p className="text-sm text-[rgb(var(--muted))]">
            Anda dapat mengelola preferensi cookie melalui pengaturan browser Anda.
          </p>
        </Section>

        {/* Perubahan Kebijakan */}
        <Section number="7" title="Perubahan Kebijakan Privasi" icon={ClockIcon}>
          <p className="text-sm text-[rgb(var(--muted))]">
            Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan material akan 
            diberitahukan melalui email atau notifikasi di Platform. Penggunaan Platform setelah perubahan 
            berlaku dianggap sebagai persetujuan atas kebijakan yang diperbarui.
          </p>
        </Section>

        {/* Kontak */}
        <section className="rounded-lg border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface-2))] to-[rgb(var(--surface-1))] p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]">
              <MailIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-[rgb(var(--fg))]">Hubungi Kami</h2>
              <p className="text-sm text-[rgb(var(--muted))]">
                Untuk pertanyaan terkait privasi dan data pribadi, silakan hubungi:{" "}
                <a href="mailto:ops@alephdraad.fun" className="font-medium text-[rgb(var(--fg))] hover:underline">
                  ops@alephdraad.fun
                </a>
              </p>
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                Dasar hukum: Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi
              </p>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
