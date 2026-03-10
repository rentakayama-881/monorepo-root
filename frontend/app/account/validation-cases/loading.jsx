import Skeleton from "@/components/ui/Skeleton";

/**
 * Loading state for /account/validation-cases
 */
export default function MyValidationCasesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header skeleton */}
        <div className="animate-pulse mb-6">
          <div className="h-7 w-56 bg-border rounded mb-2"></div>
          <div className="h-4 w-72 bg-border rounded"></div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 sm:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`mobile-${i}`}
              className="rounded-[var(--radius)] border border-border bg-card p-4"
            >
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-hidden rounded-[var(--radius)] border border-border bg-card">
          <div className="p-4">
            <div className="grid grid-cols-7 gap-3 border-b border-border pb-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={`head-${i}`} className="h-3.5 w-16" />
              ))}
            </div>
            <div className="space-y-3 pt-3">
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={`row-${row}`} className="grid grid-cols-7 gap-3">
                  {Array.from({ length: 7 }).map((__, col) => (
                    <Skeleton key={`cell-${row}-${col}`} className="h-4 w-full" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
