export default function CaseListFilters({ error }) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Personal Docket
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">My Validation Cases</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Daftar resmi kasus milik Anda. Setiap aktivitas protokol tercatat pada Case Log.
          </p>
        </div>
      </header>

      {error ? (
        <div className="mb-5 rounded-[var(--radius)] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}
    </>
  );
}
