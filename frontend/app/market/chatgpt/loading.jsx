/**
 * Loading state for /market/chatgpt — shows skeleton grid of account cards.
 */
export default function MarketChatGPTLoading() {
  return (
    <main className="container py-10">
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-40 animate-pulse bg-border rounded" />
          <div className="h-4 w-80 animate-pulse bg-border rounded" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-full sm:max-w-sm animate-pulse bg-border rounded-[var(--radius)]" />
          <div className="h-8 w-24 animate-pulse bg-border rounded-[var(--radius)]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius)] bg-card p-3" aria-hidden="true">
              <div className="flex gap-2">
                <div className="size-5 shrink-0 animate-pulse rounded bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="flex gap-1">
                    <div className="h-4 w-14 animate-pulse rounded-full bg-muted" />
                    <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-7 w-16 animate-pulse rounded-[var(--radius)] bg-muted" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
