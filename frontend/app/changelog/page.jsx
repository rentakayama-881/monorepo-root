export const dynamic = "force-static";

export const metadata = { 
  title: "Catatan Perubahan - AIvalid",
  description: "Riwayat pembaruan, fitur baru, dan perbaikan pada platform AIvalid"
};

// Version history data
const releases = [
  {
    version: "1.0.0",
    codename: "Genesis",
    date: "2026-01-03",
    type: "major",
    summary: "Rilis publik pertama AIvalid dengan Validation Protocol, escrow, dan sistem keamanan enterprise-grade.",
    changes: {
      added: [
        "Sistem autentikasi dengan email dan kata sandi",
        "Autentikasi dua faktor (TOTP) dengan aplikasi authenticator",
        "Dukungan Passkey/WebAuthn untuk login tanpa kata sandi",
        "Validation Case registry (single index) dengan taksonomi Tags untuk klasifikasi",
        "Sistem escrow untuk transaksi validasi (Lock Funds, release, dispute)",
        "Profil pengguna dengan bio, avatar, dan tautan sosial",
        "Credentials (badges, stake, dan ringkasan riwayat kasus)",
        "Panel administrasi untuk moderasi",
        "Pencarian indeks dan profil (metadata-first)",
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
        "Bug infinite scroll pada Validation Case Index",
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
    summary: "Versi alpha dengan fitur dasar Validation Case dan autentikasi.",
    changes: {
      added: [
        "Sistem registrasi dan login dasar",
        "Pembuatan Validation Case (judul, ringkasan, deskripsi)",
        "Taksonomi Tags untuk klasifikasi kasus",
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
    major: "bg-primary/10 text-primary border-primary/20",
    minor: "bg-success/10 text-success border-success/20",
    patch: "bg-muted/10 text-muted-foreground border-muted/20",
  };

  const labels = {
    major: "Major",
    minor: "Minor",
    patch: "Patch",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function ChangeSection({ title, items, icon, color }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium ${color}`}>
        {icon}
        {title}
      </h4>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">Catatan Perubahan</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Riwayat pembaruan dan perbaikan platform
        </p>
      </div>

      {/* Version Info */}
      <section className="mb-6 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Versi Saat Ini</p>
            <p className="font-semibold text-foreground">v{releases[0].version}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="text-[10px] text-muted-foreground">Codename</p>
            <p className="font-medium text-foreground">{releases[0].codename}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">Tanggal Rilis</p>
            <p className="text-sm text-foreground">{new Date(releases[0].date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </section>

      {/* Versioning Scheme */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Skema Versioning</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          AIvalid menggunakan <a href="https://semver.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Semantic Versioning 2.0.0</a> (SemVer):
        </p>
        <div className="rounded-lg border border-border p-3">
          <code className="text-sm text-foreground">MAJOR.MINOR.PATCH</code>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li><strong className="text-foreground">MAJOR</strong> — Perubahan besar yang tidak backward-compatible</li>
            <li><strong className="text-foreground">MINOR</strong> — Fitur baru yang backward-compatible</li>
            <li><strong className="text-foreground">PATCH</strong> — Perbaikan bug yang backward-compatible</li>
          </ul>
        </div>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Riwayat Rilis</h2>
        <div className="space-y-6">
          {releases.map((release, index) => (
            <article 
              key={release.version} 
              className={`relative rounded-lg border p-4 ${
                index === 0 
                  ? "border-primary/30 bg-primary/5" 
                  : "border-border"
              }`}
            >
              {/* Version Header */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-foreground">
                  v{release.version}
                  {release.codename && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      "{release.codename}"
                    </span>
                  )}
                </h3>
                <VersionBadge type={release.type} />
                {index === 0 && (
                  <span className="inline-flex items-center rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-xs font-medium text-success">
                    Latest
                  </span>
                )}
              </div>

              {/* Date */}
              <p className="mb-3 text-xs text-muted-foreground">
                {new Date(release.date).toLocaleDateString('id-ID', { 
                  weekday: 'long',
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>

              {/* Summary */}
              <p className="text-sm text-muted-foreground">{release.summary}</p>

              {/* Changes */}
              <ChangeSection 
                title="Fitur Baru" 
                items={release.changes.added}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                color="text-success"
              />
              <ChangeSection 
                title="Peningkatan" 
                items={release.changes.improved}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                color="text-primary"
              />
              <ChangeSection 
                title="Perbaikan" 
                items={release.changes.fixed}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                color="text-warning"
              />
              <ChangeSection 
                title="Keamanan" 
                items={release.changes.security}
                icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                color="text-destructive"
              />
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <section className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-foreground">Ingin fitur baru?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kirimkan saran dan masukan Anda ke{" "}
              <a href="mailto:feedback@aivalid.id" className="text-primary hover:underline">
                feedback@aivalid.id
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
