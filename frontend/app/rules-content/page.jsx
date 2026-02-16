import Link from "next/link";
import {
  CheckIcon,
  FileTextIcon,
  LockIcon,
  ScaleIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = {
  title: "Syarat dan Ketentuan - AIvalid",
  description: "Syarat dan ketentuan penggunaan platform AIvalid.",
  alternates: {
    canonical: "https://aivalid.id/rules-content",
  },
};

const accountRules = [
  "Pengguna wajib memberikan informasi yang benar saat pendaftaran.",
  "Pengguna bertanggung jawab atas keamanan akun, termasuk kata sandi dan perangkat login.",
  "Satu pengguna tidak diperkenankan membuat akun ganda untuk menghindari sanksi.",
  "Pelanggaran keamanan akun harus segera dilaporkan ke tim AIvalid.",
];

const prohibitedContent = [
  "Konten yang melanggar hukum Indonesia, termasuk penipuan dan pemerasan.",
  "Konten pornografi, kekerasan ekstrem, atau ajakan tindakan berbahaya.",
  "Ujaran kebencian, doxing, serta serangan personal terhadap pengguna lain.",
  "Konten yang melanggar hak cipta atau hak kekayaan intelektual pihak lain.",
];

const transactionRules = [
  "AIvalid menyediakan mekanisme perlindungan transaksi untuk mengurangi risiko antara pihak yang bertransaksi.",
  "Pihak penjual wajib mengirimkan hasil sesuai deskripsi yang disepakati.",
  "Pihak pembeli berhak memeriksa hasil dan mengajukan sengketa jika ada ketidaksesuaian.",
  "Keputusan akhir penyelesaian sengketa mengikuti kebijakan internal AIvalid.",
];

const sanctions = [
  "Peringatan tertulis untuk pelanggaran ringan.",
  "Pembatasan fitur atau penangguhan sementara untuk pelanggaran berulang.",
  "Penutupan akun permanen untuk pelanggaran berat.",
  "Pelaporan kepada pihak berwenang untuk pelanggaran yang berdampak hukum.",
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

function BulletList({ items, warning = false }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          {warning ? (
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <main className="container max-w-3xl py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm text-muted-foreground">Syarat dan Ketentuan</p>
        <h1 className="mb-2 text-2xl font-bold">Aturan penggunaan platform AIvalid</h1>
        <p className="text-muted-foreground">
          Dengan menggunakan <Link href="/" className="underline hover:text-foreground">aivalid.id</Link>,
          Anda menyetujui aturan penggunaan layanan, perlindungan pengguna, dan mekanisme
          penegakan kebijakan yang berlaku.
        </p>
      </header>

      <Section title="Akun Pengguna" icon={LockIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={accountRules} />
        </article>
      </Section>

      <Section title="Konten dan Perilaku" icon={FileTextIcon}>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Yang Diharapkan</h3>
            <p className="text-sm text-muted-foreground">
              Diskusi yang sopan, kontribusi yang relevan, dan penggunaan platform secara bertanggung
              jawab.
            </p>
          </article>
          <article className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Yang Dilarang</h3>
            <BulletList items={prohibitedContent} warning />
          </article>
        </div>
      </Section>

      <Section title="Transaksi dan Penyelesaian Sengketa" icon={ShieldIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={transactionRules} />
        </article>
      </Section>

      <Section title="Hak Kekayaan Intelektual" icon={ScaleIcon}>
        <article className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="mb-2">
            Pengguna tetap memiliki hak atas konten yang diunggah. Dengan mengunggah konten,
            pengguna memberikan izin terbatas kepada AIvalid untuk menampilkan konten tersebut di
            dalam platform.
          </p>
          <p>
            Merek dagang dan identitas visual AIvalid merupakan hak milik AIvalid dan tidak boleh
            digunakan tanpa izin.
          </p>
        </article>
      </Section>

      <Section title="Sanksi Pelanggaran" icon={WarningIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={sanctions} warning />
        </article>
      </Section>

      <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Perubahan Ketentuan</h2>
        <p>
          Ketentuan ini dapat diperbarui sewaktu-waktu. Penggunaan layanan setelah perubahan berlaku
          dianggap sebagai persetujuan terhadap versi terbaru ketentuan.
        </p>
      </section>
    </main>
  );
}
