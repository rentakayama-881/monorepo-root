/**
 * Account section loading state
 */
export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header skeleton */}
        <div className="animate-pulse mb-8">
          <div className="h-8 w-48 bg-border rounded mb-2"></div>
          <div className="h-4 w-64 bg-border rounded"></div>
        </div>

        {/* Profile card skeleton */}
        <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-border"></div>
            <div className="flex-1">
              <div className="h-6 w-32 bg-border rounded mb-2"></div>
              <div className="h-4 w-48 bg-border rounded"></div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="h-12 bg-border rounded"></div>
            <div className="h-12 bg-border rounded"></div>
            <div className="h-12 bg-border rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
