import Link from "next/link";
import {
  ClockIcon,
  HelpCircleIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/ui/LegalIcons";
import { generateFAQStructuredData } from "@/lib/seo";

export const dynamic = "force-static";

const faqData = [
  {
    question: "Bagaimana cara mendaftar akun?",
    answer:
      "Klik Daftar, masukkan email aktif, buat kata sandi yang kuat, lalu verifikasi email sebelum melengkapi profil.",
  },
  {
    question: "Bagaimana mekanisme perlindungan transaksi bekerja?",
    answer:
      "Dana transaksi diproses melalui alur perlindungan hingga pekerjaan dinyatakan selesai atau sengketa diputuskan sesuai kebijakan platform.",
  },
  {
    question: "Bagaimana cara mengamankan akun?",
    answer:
      "Gunakan kata sandi kuat, aktifkan autentikasi dua faktor, dan simpan backup code di tempat aman.",
  },
  {
    question: "Bagaimana cara melaporkan konten bermasalah?",
    answer:
      "Gunakan tombol laporan pada konten terkait, pilih jenis pelanggaran, dan berikan konteks agar tim moderasi dapat memproses lebih cepat.",
  },
  {
    question: "Bagaimana cara menghapus akun?",
    answer:
      "Akun dapat ditutup melalui pengaturan akun setelah seluruh kewajiban transaksi selesai.",
  },
];

const quickGuides = [
  {
    href: "/fees",
    title: "Biaya Layanan",
    description: "Lihat struktur biaya dan ketentuan penarikan dana.",
  },
  {
    href: "/rules-content",
    title: "Syarat dan Ketentuan",
    description: "Pahami aturan penggunaan platform dan penegakan kebijakan.",
  },
  {
    href: "/privacy",
    title: "Kebijakan Privasi",
    description: "Pelajari cara AIvalid mengelola data pribadi pengguna.",
  },
  {
    href: "/community-guidelines",
    title: "Pedoman Komunitas",
    description: "Standar perilaku agar komunitas tetap aman dan produktif.",
  },
];

export const metadata = {
  title: "Pusat Bantuan - AIvalid",
  description:
    "Temukan jawaban pertanyaan umum, panduan penggunaan platform, dan kanal dukungan resmi AIvalid.",
  alternates: {
    canonical: "https://aivalid.id/contact-support",
  },
};

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

export default function HelpPage() {
  const faqJsonLd = generateFAQStructuredData(faqData);

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <main className="container max-w-3xl py-10">
        <header className="mb-8">
          <p className="mb-2 text-sm text-muted-foreground">Pusat Bantuan</p>
          <h1 className="mb-2 text-2xl font-bold">Dukungan untuk pengguna AIvalid</h1>
          <p className="text-muted-foreground">
            Gunakan halaman ini untuk mendapatkan jawaban cepat, memahami alur penggunaan platform,
            dan menghubungi tim kami saat dibutuhkan.
          </p>
        </header>

        <Section title="Kontak Resmi" icon={MailIcon}>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 text-sm font-semibold">Email Bantuan</h3>
              <a href="mailto:help@aivalid.id" className="text-sm font-medium hover:underline">
                help@aivalid.id
              </a>
              <p className="mt-2 text-sm text-muted-foreground">Untuk pertanyaan umum dan kendala akun.</p>
            </article>
            <article className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                Jam Operasional
              </h3>
              <p className="text-sm text-muted-foreground">Senin-Jumat, 09.00-18.00 WIB</p>
            </article>
          </div>
        </Section>

        <Section title="Pertanyaan Umum" icon={HelpCircleIcon}>
          <div className="space-y-3">
            {faqData.map((faq) => (
              <details key={faq.question} className="rounded-lg border bg-card">
                <summary className="cursor-pointer list-none p-4 text-sm font-medium">
                  {faq.question}
                </summary>
                <div className="border-t px-4 py-3 text-sm text-muted-foreground">{faq.answer}</div>
              </details>
            ))}
          </div>
        </Section>

        <Section title="Panduan Cepat" icon={UserIcon}>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickGuides.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="rounded-lg border bg-card p-4 transition-colors hover:border-muted-foreground/50"
              >
                <h3 className="mb-1 text-sm font-semibold">{guide.title}</h3>
                <p className="text-sm text-muted-foreground">{guide.description}</p>
              </Link>
            ))}
          </div>
        </Section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <ShieldIcon className="h-4 w-4 text-muted-foreground" />
            <span>Keamanan Akun</span>
          </h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Gunakan autentikasi dua faktor untuk meningkatkan perlindungan akun Anda.
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockIcon className="h-4 w-4" />
            Simpan backup code di lokasi aman dan jangan dibagikan.
          </p>
        </section>
      </main>
    </>
  );
}
