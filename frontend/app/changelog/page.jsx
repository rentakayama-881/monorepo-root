import { ClockIcon, InfoIcon } from "@/components/ui/LegalIcons";

export const dynamic = "force-static";

export const metadata = {
  title: "Catatan Perubahan - AIvalid",
  description: "Riwayat rilis, pembaruan fitur, dan perbaikan platform AIvalid.",
  alternates: {
    canonical: "https://aivalid.id/changelog",
  },
};

const releases = [
  {
    version: "1.0.0",
    date: "2026-01-03",
    label: "Major",
    summary:
      "Rilis publik pertama AIvalid dengan fondasi keamanan akun, alur transaksi, dan sistem validasi inti.",
    added: [
      "Autentikasi akun (email dan kata sandi).",
      "Autentikasi dua faktor (2FA) dan dukungan passkey.",
      "Validation Case index dan klasifikasi berbasis tag.",
      "Dashboard moderasi dasar untuk pengelolaan platform.",
    ],
    improved: ["Performa loading halaman utama dan navigasi."],
    fixed: ["Perbaikan bug minor pada alur unggah dokumen."],
  },
  {
    version: "0.9.0",
    date: "2025-12-15",
    label: "Minor",
    summary: "Rilis beta untuk pengujian internal dengan fitur transaksi awal.",
    added: [
      "Wallet internal dan alur pembayaran awal.",
      "Notifikasi email untuk aktivitas penting akun.",
    ],
    improved: ["Penyempurnaan antarmuka login dan registrasi."],
    fixed: ["Perbaikan konsistensi tampilan mobile pada beberapa komponen."],
  },
  {
    version: "0.5.0",
    date: "2025-11-01",
    label: "Minor",
    summary: "Rilis alpha dengan fitur dasar publikasi Validation Case.",
    added: [
      "Registrasi dan login versi awal.",
      "Pembuatan Validation Case untuk pengujian komunitas.",
    ],
    improved: [],
    fixed: [],
  },
];

function ChangeBlock({ title, items }) {
  if (!items.length) return null;

  return (
    <div className="mt-3">
      <h4 className="mb-1 text-sm font-medium">{title}</h4>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  const latest = releases[0];

  return (
    <main className="container max-w-3xl py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm text-muted-foreground">Changelog</p>
        <h1 className="mb-2 text-2xl font-bold">Catatan perubahan AIvalid</h1>
        <p className="text-muted-foreground">
          Riwayat pembaruan fitur dan perbaikan produk dari waktu ke waktu.
        </p>
      </header>

      <section className="mb-10 rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">Versi Saat Ini</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">v{latest.version}</span>
          <span className="rounded-full border px-2 py-0.5 text-xs">{latest.label}</span>
          <span className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4" />
            {new Date(latest.date).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </section>

      <section className="space-y-4">
        {releases.map((release, index) => (
          <article
            key={release.version}
            className={`rounded-lg border p-4 ${index === 0 ? "bg-primary/5 border-primary/30" : "bg-card"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">v{release.version}</h2>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {release.label}
              </span>
            </div>

            <p className="mb-1 text-sm text-muted-foreground">
              {new Date(release.date).toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-sm text-muted-foreground">{release.summary}</p>

            <ChangeBlock title="Fitur Baru" items={release.added} />
            <ChangeBlock title="Peningkatan" items={release.improved} />
            <ChangeBlock title="Perbaikan" items={release.fixed} />
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          Rilis terbaru selalu ditampilkan di bagian atas. Gunakan halaman ini untuk melacak
          perubahan yang dapat memengaruhi alur kerja Anda.
        </p>
      </section>
    </main>
  );
}
