import {
  CookieIcon,
  DatabaseIcon,
  EyeIcon,
  GlobeIcon,
  MailIcon,
  ServerIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = {
  title: "Kebijakan Privasi - AIvalid",
  description: "Kebijakan privasi dan perlindungan data pribadi pengguna AIvalid.",
  alternates: {
    canonical: "https://aivalid.id/privacy",
  },
};

const providedData = [
  "Data akun: email, nama pengguna, dan kata sandi yang disimpan dalam bentuk terenkripsi.",
  "Data profil: foto, bio, dan tautan sosial jika Anda memilih untuk mengisinya.",
  "Data aktivitas: konten, laporan, transaksi, dan interaksi di dalam platform.",
];

const automaticData = [
  "Alamat IP, tipe perangkat, dan jenis browser.",
  "Waktu akses, log aktivitas, serta data teknis untuk keamanan dan audit.",
  "Cookie dan preferensi tampilan untuk menjaga pengalaman penggunaan.",
];

const usageData = [
  "Menjalankan layanan utama platform dan fitur akun pengguna.",
  "Memproses transaksi dan mekanisme perlindungan transaksi.",
  "Mencegah penyalahgunaan, spam, dan aktivitas berisiko.",
  "Meningkatkan kualitas layanan berdasarkan analisis penggunaan.",
  "Memenuhi kewajiban hukum yang berlaku di Indonesia.",
];

const sharingRules = [
  "Kami tidak menjual data pribadi pengguna.",
  "Data hanya dibagikan kepada penyedia layanan yang dibutuhkan untuk operasional (misalnya pembayaran atau infrastruktur).",
  "Data dapat diberikan kepada pihak berwenang jika diwajibkan secara hukum.",
];

const userRights = [
  "Meminta akses atas data pribadi yang tersimpan.",
  "Meminta perbaikan data yang tidak akurat.",
  "Meminta penghapusan data sesuai ketentuan yang berlaku.",
  "Membatasi atau menolak pemrosesan data pada kondisi tertentu.",
  "Menarik persetujuan pemrosesan data yang sebelumnya diberikan.",
];

const securityMeasures = [
  "Pengamanan akses data secara bertingkat.",
  "Enkripsi untuk data sensitif.",
  "Pemantauan keamanan dan audit internal secara berkala.",
  "Pencatatan log untuk investigasi insiden keamanan.",
];

const cookieUsage = [
  "Cookie esensial untuk autentikasi dan sesi login.",
  "Cookie preferensi untuk menyimpan pengaturan tampilan.",
  "Cookie analitik terbatas untuk evaluasi performa produk.",
];

function Section({ title, icon: Icon, children }) {
  return (
    <section className="mb-10 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="container max-w-3xl py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm text-muted-foreground">Kebijakan Privasi</p>
        <h1 className="mb-2 text-2xl font-bold">Perlindungan data pengguna AIvalid</h1>
        <p className="text-muted-foreground">
          Kami berkomitmen menjaga data pribadi pengguna secara bertanggung jawab sesuai prinsip
          keamanan digital dan ketentuan hukum yang berlaku.
        </p>
      </header>

      <Section title="Data yang Kami Kumpulkan" icon={DatabaseIcon}>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Data yang Anda Berikan</h3>
            <BulletList items={providedData} />
          </article>
          <article className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Data yang Terkumpul Otomatis</h3>
            <BulletList items={automaticData} />
          </article>
        </div>
      </Section>

      <Section title="Penggunaan Data" icon={EyeIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={usageData} />
        </article>
      </Section>

      <Section title="Pembagian Data" icon={GlobeIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={sharingRules} />
        </article>
      </Section>

      <Section title="Penyimpanan dan Keamanan" icon={ShieldIcon}>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Langkah Keamanan</h3>
            <BulletList items={securityMeasures} />
          </article>
          <article className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Lokasi dan Retensi Data</h3>
            <p className="text-sm text-muted-foreground">
              Data disimpan pada infrastruktur yang digunakan AIvalid dan hanya dipertahankan
              selama diperlukan untuk operasional, kepatuhan hukum, serta perlindungan hak
              pengguna.
            </p>
          </article>
        </div>
      </Section>

      <Section title="Hak Anda atas Data Pribadi" icon={UserIcon}>
        <article className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Mengacu pada Undang-Undang Perlindungan Data Pribadi (UU No. 27 Tahun 2022), Anda
            memiliki hak untuk mengelola data pribadi Anda.
          </p>
          <BulletList items={userRights} />
        </article>
      </Section>

      <Section title="Cookie" icon={CookieIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={cookieUsage} />
        </article>
      </Section>

      <Section title="Perubahan Kebijakan" icon={ServerIcon}>
        <article className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Kebijakan ini dapat diperbarui sewaktu-waktu. Jika ada perubahan penting, kami akan
          menyampaikan pemberitahuan melalui platform atau email terdaftar.
        </article>
      </Section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <MailIcon className="h-4 w-4 text-muted-foreground" />
          <span>Kontak Privasi</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Untuk pertanyaan tentang privasi dan data pribadi, hubungi
          <a href="mailto:ops@aivalid.id" className="ml-1 font-medium text-foreground hover:underline">
            ops@aivalid.id
          </a>
          .
        </p>
      </section>
    </main>
  );
}
