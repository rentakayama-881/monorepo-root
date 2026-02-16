import { CheckIcon, ShieldIcon, TargetIcon, UsersIcon } from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = {
  title: "Tentang AIValid",
  description:
    "Kisah di balik AIvalid.id, platform validasi keluaran AI untuk pekerjaan berskala besar yang menuntut akurasi dan dapat dipertanggungjawabkan.",
  alternates: {
    canonical: "https://aivalid.id/about-content",
  },
};

const coreProblems = [
  {
    title: "Konteks Besar, Kualitas Turun",
    description:
      "Dalam konteks yang sangat panjang, AI sering kehilangan konsistensi, melewatkan detail penting, atau menghasilkan jawaban yang tidak stabil.",
  },
  {
    title: "Output Sulit Dipertanggungjawabkan",
    description:
      "Untuk pekerjaan serius, keluaran AI tidak cukup hanya terlihat meyakinkan. Hasilnya harus bisa diuji, diverifikasi, dan dipertanggungjawabkan.",
  },
];

const hopes = [
  "Membantu pengguna menyelesaikan tugas dan pekerjaan yang melibatkan AI dengan standar kualitas yang lebih tinggi.",
  "Mengurangi waktu yang terbuang untuk revisi berulang akibat output AI yang tidak konsisten.",
  "Mendorong proses kerja yang lebih efektif: AI tetap digunakan, tetapi hasil akhirnya tetap terkontrol dan terverifikasi.",
  "Menjadi jembatan antara kecepatan AI dan kebutuhan manusia atas hasil yang akurat.",
];

function Section({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`mb-10 space-y-3 ${className}`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="container max-w-3xl py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm text-muted-foreground">Tentang AIvalid.id</p>
        <h1 className="mb-2 text-2xl font-bold">Membawa validasi manusia ke keluaran AI</h1>
        <p className="text-muted-foreground">
          Kisah di balik platform validasi keluaran AI untuk tugas berskala besar yang menuntut
          keakuratan dan hasil yang dapat dipertanggungjawabkan.
        </p>
      </header>

      <Section title="Kisah di Balik AIvalid.id" icon={TargetIcon}>
        <p className="text-muted-foreground">
          AIvalid.id lahir dari kebutuhan nyata di lapangan. Banyak pekerjaan penting sudah
          menggunakan AI, tetapi tidak semua keluaran AI aman dipakai langsung tanpa pemeriksaan.
        </p>
        <p className="text-muted-foreground">
          Saat kebutuhan makin besar, konteks makin kompleks, dan dampak keputusan makin serius,
          risiko kesalahan juga meningkat. Di titik itulah proses validasi menjadi hal yang wajib,
          bukan pilihan.
        </p>
      </Section>

      <Section title="Yang Ingin Kami Sampaikan" icon={ShieldIcon}>
        <p className="text-muted-foreground">
          AIvalid.id adalah dedikasi kami untuk menjawab persoalan yang sering terjadi dalam
          penggunaan AI sehari-hari.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {coreProblems.map((problem) => (
            <article key={problem.title} className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 text-sm font-semibold">{problem.title}</h3>
              <p className="text-sm text-muted-foreground">{problem.description}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Harapan Kami" icon={UsersIcon}>
        <p className="text-muted-foreground">
          Kami berharap platform ini membantu lebih banyak orang menyelesaikan tugas, pekerjaan,
          dan proyek yang melibatkan AI secara lebih aman dan efisien.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {hopes.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Contoh Sederhana" icon={ShieldIcon} className="mb-0">
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="mb-3">
            Bayangkan Anda seorang pengacara yang mengandalkan AI untuk menyusun analisis hukum.
            Pada kasus kecil, AI mungkin masih cukup membantu.
          </p>
          <p className="mb-3">
            Namun saat perkara membesar, Anda perlu konteks yang jauh lebih panjang, waktu lebih
            banyak, biaya lebih besar, dan energi lebih tinggi hanya untuk memastikan AI memahami
            instruksi dengan benar.
          </p>
          <p>
            Jika hasil AI tetap tidak akurat, risikonya sangat besar. AIvalid.id hadir untuk
            menutup celah itu: membantu memastikan keluaran AI lebih terjaga kualitasnya sebelum
            dipakai untuk keputusan penting.
          </p>
        </div>
      </Section>
    </main>
  );
}
