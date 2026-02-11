import Link from "next/link";
import { notFound } from "next/navigation";

const CATEGORIES = {
  coding: {
    title: "Validasi Kode Program Buatan AI",
    metaTitle: "Validasi Kode AI - Cek Kualitas Kode Program Buatan AI",
    metaDescription:
      "Kirim kode program buatan ChatGPT, Copilot, atau AI lainnya untuk direview oleh developer berpengalaman. Cek bug, keamanan, dan kualitas kode AI Anda.",
    keywords: ["validasi kode AI", "cek kode program AI", "review kode ChatGPT", "bug review AI code"],
    h1: "Validasi Kode Program Buatan AI",
    intro:
      "Kode program yang dihasilkan oleh AI seperti ChatGPT, GitHub Copilot, atau Claude sering kali terlihat benar di permukaan — tetapi bisa mengandung bug tersembunyi, masalah keamanan, atau pola yang tidak optimal. AIValid menghubungkan Anda dengan developer berpengalaman yang akan mereview kode AI secara menyeluruh.",
    description:
      "Validator kami adalah developer profesional yang memahami berbagai bahasa pemrograman dan framework. Mereka akan memeriksa kode Anda dari berbagai aspek: fungsionalitas, keamanan, performa, dan best practices. Setiap review menghasilkan laporan terstruktur yang menjelaskan temuan dan rekomendasi perbaikan.",
    steps: [
      "Kirimkan kode program buatan AI beserta konteks penggunaannya",
      "Validator developer akan mereview fungsionalitas, keamanan, dan kualitas kode",
      "Dapatkan laporan lengkap dengan temuan bug, saran optimasi, dan rekomendasi perbaikan",
      "Revisi kode Anda berdasarkan feedback profesional dari validator",
    ],
    useCases: [
      "Review kode backend/frontend yang dihasilkan ChatGPT atau Copilot",
      "Audit keamanan untuk kode AI yang akan digunakan di production",
      "Validasi logika algoritma yang ditulis oleh AI",
      "Pengecekan kode tugas pemrograman yang menggunakan bantuan AI",
    ],
  },
  "riset-ilmiah": {
    title: "Validasi Riset Ilmiah yang Dibuat AI",
    metaTitle: "Validasi Riset AI - Review Paper, Skripsi & Jurnal Buatan AI",
    metaDescription:
      "Review riset ilmiah, paper, skripsi, atau jurnal yang dibantu AI oleh akademisi berpengalaman. Pastikan metodologi, sitasi, dan analisis Anda valid.",
    keywords: ["validasi riset AI", "cek paper AI", "review skripsi AI", "validasi jurnal AI"],
    h1: "Validasi Riset Ilmiah yang Dibuat AI",
    intro:
      "Riset ilmiah yang dibantu oleh AI bisa mempercepat proses penulisan, tetapi memiliki risiko tinggi: sitasi fiktif, metodologi yang tidak tepat, analisis statistik yang keliru, hingga plagiarisme tidak disengaja. AIValid menyediakan validator dari kalangan akademisi dan peneliti berpengalaman.",
    description:
      "Validator akademisi kami akan memeriksa kelengkapan dan kebenaran riset Anda — mulai dari validitas sitasi, kesesuaian metodologi, kebenaran analisis data, hingga orisinalitas penulisan. Proses review dilakukan secara menyeluruh untuk memastikan riset Anda memenuhi standar akademik.",
    steps: [
      "Upload draft paper, skripsi, atau jurnal yang menggunakan bantuan AI",
      "Validator akademisi mereview metodologi, sitasi, dan analisis data",
      "Terima laporan detail tentang temuan — sitasi fiktif, kelemahan metodologi, dll",
      "Perbaiki riset Anda berdasarkan masukan validator sebelum submission",
    ],
    useCases: [
      "Review skripsi atau tesis yang menggunakan bantuan AI untuk penulisan",
      "Validasi sitasi dan referensi pada paper yang digenerate AI",
      "Pengecekan metodologi riset yang disusun dengan bantuan ChatGPT",
      "Review analisis statistik yang dihasilkan oleh AI",
    ],
  },
  "tugas-kuliah": {
    title: "Cek Tugas Kuliah yang Dibuat dengan AI",
    metaTitle: "Cek Tugas Kuliah AI - Validasi Tugas ChatGPT & AI Lainnya",
    metaDescription:
      "Pastikan tugas kuliah yang menggunakan bantuan AI tetap berkualitas dan orisinal. Validator berpengalaman akan mereview dan memberikan feedback konstruktif.",
    keywords: ["cek tugas kuliah AI", "validasi tugas ChatGPT", "review tugas AI", "cek essay AI"],
    h1: "Cek Tugas Kuliah yang Dibuat dengan AI",
    intro:
      "Menggunakan AI untuk mengerjakan tugas kuliah sudah menjadi hal umum — tetapi hasilnya sering kali dangkal, mengandung informasi yang tidak akurat, atau mudah terdeteksi sebagai tulisan AI. AIValid membantu mahasiswa memastikan tugas mereka berkualitas dan layak dikumpulkan.",
    description:
      "Validator kami terdiri dari akademisi dan profesional yang memahami standar akademik berbagai disiplin ilmu. Mereka akan memeriksa akurasi konten, kedalaman analisis, kualitas penulisan, dan orisinalitas tugas Anda. Feedback yang diberikan bersifat konstruktif untuk membantu proses pembelajaran.",
    steps: [
      "Kirimkan tugas kuliah yang menggunakan bantuan AI beserta instruksi dosen",
      "Validator memeriksa akurasi, kedalaman analisis, dan kualitas penulisan",
      "Dapatkan feedback konstruktif dan saran perbaikan spesifik",
      "Revisi tugas Anda menjadi lebih berkualitas sebelum deadline",
    ],
    useCases: [
      "Review essay atau makalah yang ditulis dengan bantuan ChatGPT",
      "Validasi jawaban tugas take-home exam yang menggunakan AI",
      "Pengecekan laporan praktikum yang dibantu AI",
      "Review presentasi atau proposal tugas akhir",
    ],
  },
  dokumen: {
    title: "Validasi Dokumen yang Dihasilkan AI",
    metaTitle: "Validasi Dokumen AI - Review SOP, Laporan & Dokumen Buatan AI",
    metaDescription:
      "Review dokumen bisnis, SOP, laporan, atau proposal yang dihasilkan AI oleh profesional berpengalaman. Pastikan akurasi dan kualitas dokumen Anda.",
    keywords: ["validasi dokumen AI", "review SOP AI", "cek laporan AI", "review proposal AI"],
    h1: "Validasi Dokumen yang Dihasilkan AI",
    intro:
      "Dokumen bisnis yang dihasilkan AI — seperti SOP, laporan, proposal, atau kontrak — bisa menghemat waktu tetapi sering mengandung kesalahan faktual, inkonsistensi, atau bahasa yang terlalu generik. AIValid menyediakan validator profesional untuk memastikan dokumen Anda akurat dan berkualitas.",
    description:
      "Validator profesional kami memiliki pengalaman di berbagai industri dan akan memeriksa dokumen Anda dari segi akurasi konten, konsistensi terminologi, kejelasan struktur, dan kesesuaian dengan standar industri. Setiap review menghasilkan laporan terstruktur dengan rekomendasi perbaikan.",
    steps: [
      "Upload dokumen bisnis yang dihasilkan atau dibantu oleh AI",
      "Validator profesional memeriksa akurasi, konsistensi, dan kualitas dokumen",
      "Terima laporan review dengan temuan dan rekomendasi perbaikan",
      "Perbaiki dokumen berdasarkan feedback sebelum digunakan secara resmi",
    ],
    useCases: [
      "Review SOP perusahaan yang digenerate dengan bantuan AI",
      "Validasi proposal bisnis atau project plan buatan AI",
      "Pengecekan laporan keuangan atau teknis yang dibantu AI",
      "Review kontrak atau dokumen legal yang didraft dengan AI",
    ],
  },
  "ui-ux": {
    title: "Validasi Desain UI/UX Buatan AI",
    metaTitle: "Validasi UI/UX AI - Audit Desain & Prototype Buatan AI",
    metaDescription:
      "Audit desain UI/UX yang dihasilkan AI oleh desainer berpengalaman. Pastikan usability, aksesibilitas, dan konsistensi desain produk digital Anda.",
    keywords: ["validasi UI UX AI", "audit desain AI", "review prototype AI", "cek UI AI"],
    h1: "Validasi Desain UI/UX Buatan AI",
    intro:
      "AI bisa menghasilkan mockup dan prototype dengan cepat, tetapi hasilnya sering mengabaikan prinsip UX yang baik — navigasi yang membingungkan, aksesibilitas buruk, atau inkonsistensi visual. AIValid menghubungkan Anda dengan desainer UI/UX berpengalaman untuk mereview desain AI Anda.",
    description:
      "Validator desainer kami akan mengevaluasi desain dari berbagai aspek: usability, aksesibilitas (WCAG), konsistensi visual, user flow, dan kesesuaian dengan platform target. Review mencakup analisis heuristik dan rekomendasi perbaikan praktis yang bisa langsung diimplementasikan.",
    steps: [
      "Upload mockup, wireframe, atau prototype yang dihasilkan AI",
      "Validator desainer mengevaluasi usability, aksesibilitas, dan konsistensi",
      "Dapatkan laporan audit dengan temuan masalah dan rekomendasi perbaikan",
      "Iterasi desain berdasarkan feedback profesional sebelum development",
    ],
    useCases: [
      "Audit mockup yang dihasilkan oleh AI design tools",
      "Review user flow dan navigasi yang dirancang dengan bantuan AI",
      "Pengecekan aksesibilitas desain yang digenerate AI",
      "Validasi design system atau komponen UI buatan AI",
    ],
  },
  keamanan: {
    title: "Security Review untuk Output AI",
    metaTitle: "Security Review AI - Audit Keamanan Output & Kode Buatan AI",
    metaDescription:
      "Audit keamanan untuk kode, konfigurasi, atau infrastruktur yang dihasilkan AI. Identifikasi vulnerability dan risiko sebelum deployment ke production.",
    keywords: ["validasi keamanan AI", "security review AI", "audit keamanan kode AI", "pentest AI code"],
    h1: "Security Review untuk Output AI",
    intro:
      "Kode dan konfigurasi yang dihasilkan AI sering mengandung kerentanan keamanan yang tidak terdeteksi: injection vulnerabilities, misconfiguration, exposed secrets, atau pola yang tidak aman. AIValid menyediakan security reviewer berpengalaman untuk audit mendalam.",
    description:
      "Validator keamanan kami adalah profesional cybersecurity yang memahami OWASP Top 10, secure coding practices, dan berbagai attack vector. Mereka akan melakukan static analysis, review konfigurasi, dan identifikasi risiko keamanan pada output AI Anda. Setiap temuan dilengkapi dengan severity rating dan rekomendasi mitigasi.",
    steps: [
      "Kirimkan kode, konfigurasi, atau infrastruktur setup yang dihasilkan AI",
      "Security reviewer melakukan audit keamanan menyeluruh",
      "Terima laporan dengan temuan vulnerability, severity rating, dan mitigasi",
      "Perbaiki kerentanan keamanan sebelum deployment ke production",
    ],
    useCases: [
      "Security audit untuk API atau backend yang digenerate AI",
      "Review konfigurasi server/cloud yang disetup dengan bantuan AI",
      "Pengecekan kode smart contract yang ditulis AI",
      "Validasi keamanan deployment script atau CI/CD pipeline buatan AI",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((category) => ({ category }));
}

export async function generateMetadata({ params }) {
  const { category } = await params;
  const cat = CATEGORIES[category];
  if (!cat) return {};

  return {
    title: cat.metaTitle,
    description: cat.metaDescription,
    keywords: cat.keywords,
    alternates: {
      canonical: `https://aivalid.id/validasi/${category}`,
    },
    openGraph: {
      title: cat.metaTitle,
      description: cat.metaDescription,
      url: `https://aivalid.id/validasi/${category}`,
    },
  };
}

export default async function CategoryLandingPage({ params }) {
  const { category } = await params;
  const cat = CATEGORIES[category];
  if (!cat) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: cat.title,
    description: cat.metaDescription,
    provider: {
      "@type": "Organization",
      name: "AIvalid",
      url: "https://aivalid.id",
    },
    url: `https://aivalid.id/validasi/${category}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {cat.h1}
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            {cat.intro}
          </p>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Mengapa Perlu Validasi?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {cat.description}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Cara Kerja
          </h2>
          <ol className="space-y-3">
            {cat.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Contoh Penggunaan
          </h2>
          <ul className="space-y-2">
            {cat.useCases.map((useCase, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Mulai Validasi Sekarang
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Daftar gratis dan kirimkan kasus validasi pertama Anda. Validator ahli siap mereview dalam hitungan jam.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Daftar Gratis
            </Link>
            <Link
              href="/validation-cases/new"
              className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              Buat Kasus Validasi
            </Link>
          </div>
        </section>

        <nav className="mt-8 border-t border-border pt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Kategori Validasi Lainnya
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORIES)
              .filter(([slug]) => slug !== category)
              .map(([slug, c]) => (
                <Link
                  key={slug}
                  href={`/validasi/${slug}`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {c.title}
                </Link>
              ))}
          </div>
        </nav>
      </main>
    </>
  );
}
