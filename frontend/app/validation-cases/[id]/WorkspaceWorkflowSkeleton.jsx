import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

function skeletonClassName(className = "") {
  return ["space-y-7", className].filter(Boolean).join(" ");
}

export default function WorkspaceWorkflowSkeleton({ className = "" }) {
  return (
    <div className={skeletonClassName(className)} aria-busy="true" aria-live="polite">
      <section className="space-y-4">
        <SkeletonText width="w-40" height="h-3.5" />
        <div className="overflow-hidden rounded-[var(--radius)] border border-border/70 bg-card">
          <div className="hidden gap-3 border-b border-border/70 bg-background px-4 py-3 md:grid md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`repo-head-${i}`} className="h-4 w-20" />
            ))}
          </div>
          <div>
            {Array.from({ length: 6 }).map((_, row) => (
              <div
                key={`repo-row-${row}`}
                className="border-b border-border/70 px-4 py-3 last:border-b-0"
              >
                <div className="space-y-2 md:hidden">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
                <div className="hidden gap-3 md:grid md:grid-cols-6">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <Skeleton key={`repo-cell-${row}-${col}`} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SkeletonText width="w-36" height="h-3.5" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-40 rounded-[var(--radius)]" />
          <SkeletonText width="w-full max-w-xs" height="h-3" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, card) => (
            <div
              key={`validator-card-${card}`}
              className="space-y-3 rounded-[var(--radius)] border border-border/70 bg-card p-4"
            >
              <SkeletonText width="w-32" height="h-4" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((__, row) => (
                  <div
                    key={`validator-row-${card}-${row}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-[var(--radius)]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SkeletonText width="w-24" height="h-3.5" />
        <div className="space-y-3 rounded-[var(--radius)] border border-border/70 bg-card p-5">
          <Skeleton className="h-5 w-full rounded-lg" />
          <Skeleton className="h-5 w-4/5 rounded-lg" />
          <Skeleton className="h-5 w-3/5 rounded-lg" />
          <Skeleton className="h-28 w-full rounded-[var(--radius)] border border-border/70 bg-background" />
        </div>
      </section>
    </div>
  );
}
