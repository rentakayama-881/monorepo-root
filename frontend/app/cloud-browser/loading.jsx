/**
 * Loading state for /cloud-browser — skeleton grid of profile cards.
 */
export default function CloudBrowserLoading() {
  return (
    <main className="container py-10">
      <div className="space-y-6">
        {/* Pricing banner skeleton */}
        <div className="rounded-[var(--radius)] bg-card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>

        {/* Header skeleton */}
        <div className="space-y-1">
          <div className="h-7 w-48 animate-pulse rounded bg-border" />
          <div className="h-4 w-80 animate-pulse rounded bg-border" />
        </div>

        {/* Grid skeleton */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius)] bg-card p-4" aria-hidden="true">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                <div className="flex justify-end gap-1.5">
                  <div className="h-7 w-20 animate-pulse rounded-[var(--radius)] bg-muted" />
                  <div className="h-7 w-14 animate-pulse rounded-[var(--radius)] bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
