import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function ValidationCaseRecordSkeleton() {
  return (
    <main className="container py-10" aria-busy="true" aria-live="polite">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <SkeletonText width="w-12" height="h-4" />
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonText width="w-20" height="h-4" />
      </div>

      <div className="space-y-10 lg:grid lg:grid-cols-12 lg:gap-10 lg:space-y-0">
        <div className="lg:col-span-8 space-y-10">
          <header className="space-y-4">
            <SkeletonText width="w-44" height="h-3" />
            <SkeletonText width="w-full max-w-2xl" height="h-10" />
            <SkeletonText width="w-full max-w-3xl" height="h-4" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </header>

          <section className="space-y-4">
            <SkeletonText width="w-28" height="h-3" />
            <SkeletonText width="w-44" height="h-7" />
            <div className="overflow-hidden rounded-[var(--radius)] bg-card">
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-3 bg-secondary/40 px-4 py-3">
                  <SkeletonText width="w-24" height="h-3" />
                </div>
                <div className="md:col-span-9 px-4 py-3">
                  <Skeleton className="h-72 w-full" />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SkeletonText width="w-36" height="h-3" />
            <SkeletonText width="w-56" height="h-7" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </section>

          <section className="space-y-4">
            <SkeletonText width="w-28" height="h-3" />
            <SkeletonText width="w-52" height="h-7" />
            <Skeleton className="h-56 w-full" />
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <SkeletonText width="w-28" height="h-3" />
          <div className="overflow-hidden rounded-[var(--radius)] bg-secondary/20">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12">
                  <div className="col-span-4 bg-secondary/40 px-4 py-3">
                    <SkeletonText width="w-16" height="h-3" />
                  </div>
                  <div className="col-span-8 px-4 py-3">
                    {i === 5 ? (
                      <div className="flex items-center gap-2">
                        <SkeletonCircle size="h-7 w-7" />
                        <SkeletonText width="w-28" height="h-4" />
                      </div>
                    ) : (
                      <SkeletonText width="w-28" height="h-4" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SkeletonText width="w-full max-w-sm" height="h-3" />
          <SkeletonText width="w-full max-w-xs" height="h-3" />
        </aside>
      </div>
    </main>
  );
}
