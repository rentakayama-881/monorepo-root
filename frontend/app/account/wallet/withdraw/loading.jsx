/**
 * Loading state for /account/wallet/withdraw
 */
export default function WithdrawLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Back button skeleton */}
        <div className="animate-pulse mb-6">
          <div className="h-5 w-24 bg-border rounded"></div>
        </div>

        {/* Title skeleton */}
        <div className="animate-pulse mb-8">
          <div className="h-7 w-40 bg-border rounded mb-2"></div>
          <div className="h-4 w-64 bg-border rounded"></div>
        </div>

        {/* Balance card skeleton */}
        <div className="rounded-[var(--radius)] border border-border bg-card p-6 animate-pulse mb-6">
          <div className="h-4 w-24 bg-border rounded mb-2"></div>
          <div className="h-8 w-48 bg-border rounded"></div>
        </div>

        {/* Form skeleton */}
        <div className="space-y-4 animate-pulse">
          <div className="h-12 bg-border rounded"></div>
          <div className="h-12 bg-border rounded"></div>
          <div className="h-12 bg-border rounded"></div>
          <div className="h-10 w-full bg-border rounded"></div>
        </div>
      </div>
    </div>
  );
}
