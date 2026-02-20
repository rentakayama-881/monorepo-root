export default function UsernameSection({ username }) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Username</h3>
      <div className="mt-1 text-sm text-foreground">
        Saat ini: <b>{username || "(belum ada)"}</b>
      </div>
      <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
        <div className="flex items-center gap-2 text-sm text-warning">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="font-medium">Fitur Segera Hadir</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Fitur ganti username akan segera tersedia. Layanan ini berbayar Rp.100.000 dan saldo IDR akan dipotong otomatis.
        </p>
      </div>
    </section>
  );
}
