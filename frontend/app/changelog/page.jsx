export const dynamic = "force-static";

export const metadata = { 
  title: "Catatan Perubahan - AlephDraad",
  description: "Riwayat pembaruan, fitur baru, dan perbaikan pada platform AlephDraad"
};

// Version history data
const releases = [
  {
    version: "1.0.0",
    codename: "Genesis",
    date: "2026-01-03",
    type: "major",
    summary: "Rilis publik pertama AlephDraad dengan fitur lengkap forum, marketplace, dan sistem keamanan enterprise-grade.",
    changes: {
      added: [
        "Sistem autentikasi dengan email dan kata sandi",
        "Autentikasi dua faktor (TOTP) dengan aplikasi authenticator",
        "Dukungan Passkey/WebAuthn untuk login tanpa kata sandi",
        "Forum diskusi dengan kategori dan threading",
        "Sistem marketplace dengan escrow untuk transaksi aman",
        "Profil pengguna dengan bio, avatar, dan tautan sosial",
        "Sistem lencana dan reputasi",
        "Panel administrasi untuk moderasi",
        "Pencarian berbasis AI dengan semantic search",
        "Mode gelap/terang otomatis",
        "Responsif untuk semua ukuran layar",
      ],
      improved: [],
      fixed: [],
      security: [
        "Enkripsi kata sandi dengan bcrypt",
        "Token refresh dengan rotasi otomatis",
        "Session management dengan fingerprinting",
        "Perlindungan CSRF dan XSS",
        "Rate limiting untuk mencegah brute force",
        "Sudo mode untuk aksi sensitif",
      ],
    },
  },
  {
    version: "0.9.0",
    codename: "Beta",
    date: "2025-12-15",
    type: "minor",
    summary: "Versi beta untuk pengujian internal dan early adopters.",
    changes: {
      added: [
        "Integrasi payment gateway",
        "Sistem wallet internal",
        "Fitur penarikan dana",
        "Notifikasi email transaksional",
      ],
      improved: [
        "Performa loading halaman",
        "UI/UX form registrasi dan login",
      ],
      fixed: [
        "Bug infinite scroll pada halaman thread",
        "Masalah upload avatar di mobile",
      ],
      security: [],
    },
  },
  {
    version: "0.5.0",
    codename: "Alpha",
    date: "2025-11-01",
    type: "minor",
    summary: "Versi alpha dengan fitur dasar forum dan autentikasi.",
    changes: {
      added: [
        "Sistem registrasi dan login dasar",
        "Pembuatan thread dan komentar",
        "Kategori forum",
        "Profil pengguna dasar",
      ],
      improved: [],
      fixed: [],
      security: [],
    },
  },
];

function VersionBadge({ type }) {
  const styles = {
    major: "bg-[rgb(var(--brand))/0.1] text-[rgb(var(--brand))] border-[rgb(var(--brand))/0.2]",
    minor: "bg-[rgb(var(--success))/0.1] text-[rgb(var(--success))] border-[rgb(var(--success))/0.2]",
    patch: "bg-[rgb(var(--muted))/0.1] text-[rgb(var(--muted))] border-[rgb(var(--muted))/0.2]",
  };

  const labels = {
    major: "Major",
    minor: "Minor",
    patch: "Patch",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function ChangeSection({ title, items, icon, color }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className={`mb-2 flex items-center gap-2 text-sm font-medium ${color}`}>
        {icon}
        {title}
      </h4>
      <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Catatan Perubahan</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Riwayat pembaruan dan perbaikan platform
        </p>
      </div>

      {/* Version Info */}
      <section className="mb-8 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Versi Saat Ini</p>
            <p className="text-lg font-semibold text-[rgb(var(--fg))]">v{releases[0].version}</p>
          </div>
          <div className="h-8 w-px bg-[rgb(var(--border))]" />
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Codename</p>
            <p className="text-sm font-medium text-[rgb(var(--fg))]">{releases[0].codename}</p>
          </div>
          <div className="h-8 w-px bg-[rgb(var(--border))]" />
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Tanggal Rilis</p>
            <p className="text-sm text-[rgb(var(--fg))]">{new Date(releases[0].date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </section>

      {/* Versioning Scheme */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--fg))]">Skema Versioning</h2>
        <p className="mb-3 text-sm text-[rgb(var(--muted))]">
          AlephDraad menggunakan <a href="https://semver.org" target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--brand))] hover:underline">Semantic Versioning 2.0.0</a> (SemVer):
        </p>
        <div className="rounded-lg border border-[rgb(var(--border))] p-3">
          <code className="text-sm text-[rgb(var(--fg))]">MAJOR.MINOR.PATCH</code>
          <ul className="mt-2 space-y-1 text-xs text-[rgb(var(--muted))]">
            <li><strong className="text-[rgb(var(--fg))]">MAJOR</strong> — Perubahan besar yang tidak backward-compatible</li>
            <li><strong className="text-[rgb(var(--fg))]">MINOR</strong> — Fitur baru yang backward-compatible</li>
            <li><strong className="text-[rgb(var(--fg))]">PATCH</strong> — Perbaikan bug yang backward-compatible</li>
          </ul>
        </div>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Riwayat Rilis</h2>
        <div className="space-y-6">
          {releases.map((release, index) => (
            <article 
              key={release.version} 
              className={`relative rounded-lg border p-4 ${
                index === 0 
                  ? "border-[rgb(var(--brand))/0.3] bg-[rgb(var(--brand))/0.02]" 
                  : "border-[rgb(var(--border))]"
              }`}
            >
              {/* Version Header */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-[rgb(var(--fg))]">
                  v{release.version}
                  {release.codename && (
                    <span className="ml-2 text-sm font-normal text-[rgb(var(--muted))]">
                      "{release.codename}"
                    </span>
                  )}
                </h3>
                <VersionBadge type={release.type} />
                {index === 0 && (
                  <span className="inline-flex items-center rounded-full bg-[rgb(var(--success))/0.1] border border-[rgb(var(--success))/0.2] px-2 py-0.5 text-xs font-medium text-[rgb(var(--success))]">
                    Latest
                  </span>
                )}
              </div>

              {/* Date */}
              <p className="mb-3 text-xs text-[rgb(var(--muted))]">
                {new Date(release.date).toLocaleDateString('id-ID', { 
                  weekday: 'long',
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>

              {/* Summary */}
              <p className="text-sm text-[rgb(var(--muted))]">{release.summary}</p>

              {/* Changes */}
              <ChangeSection 
                title="Fitur Baru" 
                items={release.changes.added}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                color="text-[rgb(var(--success))]"
              />
              <ChangeSection 
                title="Peningkatan" 
                items={release.changes.improved}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                color="text-[rgb(var(--brand))]"
              />
              <ChangeSection 
                title="Perbaikan" 
                items={release.changes.fixed}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                color="text-[rgb(var(--warning))]"
              />
              <ChangeSection 
                title="Keamanan" 
                items={release.changes.security}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                color="text-[rgb(var(--error))]"
              />
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <section className="mt-8 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[rgb(var(--fg))]">Ingin fitur baru?</p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Kirimkan saran dan masukan Anda ke{" "}
              <a href="mailto:ops@alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">
                ops@alephdraad.fun
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
