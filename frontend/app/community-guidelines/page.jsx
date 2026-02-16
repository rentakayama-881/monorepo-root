import {
  CheckIcon,
  HeartIcon,
  MailIcon,
  ShieldIcon,
  UsersIcon,
  WarningIcon,
} from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = {
  title: "Pedoman Komunitas - AIvalid",
  description:
    "Pedoman komunitas AIvalid untuk menjaga ruang diskusi yang aman, inklusif, dan produktif.",
  alternates: {
    canonical: "https://aivalid.id/community-guidelines",
  },
};

const expectedBehavior = [
  "Bersikap sopan, profesional, dan menghargai perbedaan pendapat.",
  "Memberikan kritik yang fokus pada isi pembahasan, bukan menyerang pribadi.",
  "Membagikan konten yang relevan, bermanfaat, dan dapat dipertanggungjawabkan.",
  "Melaporkan pelanggaran dengan bukti yang jelas.",
  "Menjaga etika saat bertransaksi dan memenuhi komitmen yang disepakati.",
];

const prohibitedBehavior = [
  "Pelecehan, ancaman, doxing, dan bentuk intimidasi lain.",
  "Konten kebencian berbasis SARA dan diskriminasi terhadap kelompok tertentu.",
  "Konten berbahaya: pornografi ilegal, kekerasan ekstrem, atau ajakan tindakan kriminal.",
  "Spam, manipulasi sistem, dan upaya penyalahgunaan fitur platform.",
  "Penipuan dalam transaksi atau klaim palsu yang merugikan pengguna lain.",
];

const sanctions = [
  {
    level: "Ringan",
    action: "Peringatan, penghapusan konten, atau pembatasan sementara pada fitur tertentu.",
  },
  {
    level: "Sedang",
    action: "Penangguhan akun sementara sesuai tingkat pelanggaran.",
  },
  {
    level: "Berat",
    action: "Penutupan akun permanen dan pelaporan ke pihak berwenang jika diperlukan.",
  },
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

export default function CommunityGuidelinesPage() {
  return (
    <main className="container max-w-3xl py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm text-muted-foreground">Pedoman Komunitas</p>
        <h1 className="mb-2 text-2xl font-bold">Standar interaksi di AIvalid</h1>
        <p className="text-muted-foreground">
          Pedoman ini membantu menjaga AIvalid sebagai ruang yang aman, adil, dan produktif untuk
          seluruh pengguna.
        </p>
      </header>

      <Section title="Nilai Dasar" icon={HeartIcon}>
        <article className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Kami menjunjung rasa hormat, tanggung jawab, dan kolaborasi. Kebebasan berpendapat tetap
          dihormati selama tidak melanggar hukum, etika komunitas, dan hak pengguna lain.
        </article>
      </Section>

      <Section title="Perilaku yang Diharapkan" icon={UsersIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={expectedBehavior} />
        </article>
      </Section>

      <Section title="Perilaku yang Dilarang" icon={WarningIcon}>
        <article className="rounded-lg border bg-card p-4">
          <BulletList items={prohibitedBehavior} warning />
        </article>
      </Section>

      <Section title="Penegakan dan Sanksi" icon={ShieldIcon}>
        <div className="space-y-3">
          {sanctions.map((item) => (
            <article key={item.level} className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 text-sm font-semibold">Pelanggaran {item.level}</h3>
              <p className="text-sm text-muted-foreground">{item.action}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <MailIcon className="h-4 w-4 text-muted-foreground" />
          <span>Laporan Pelanggaran</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Untuk laporan pelanggaran atau pertanyaan terkait pedoman komunitas, hubungi
          <a href="mailto:ops@aivalid.id" className="ml-1 font-medium text-foreground hover:underline">
            ops@aivalid.id
          </a>
          .
        </p>
      </section>
    </main>
  );
}
