import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function ValidationCaseRecordSkeleton() {
  return (
    <main className="container min-h-screen py-10" aria-busy="true" aria-live="polite">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <SkeletonText width="w-12" height="h-4" />
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonText width="w-20" height="h-4" />
      </div>

      <div className="space-y-10 lg:grid lg:grid-cols-12 lg:gap-10 lg:space-y-0">
        <div className="lg:col-span-8 space-y-10">
          <header className="space-y-4 rounded-2xl bg-secondary/20 px-5 py-5">
            <SkeletonText width="w-44" height="h-3" />
            <SkeletonText width="w-full max-w-2xl" height="h-10" />
            <SkeletonText width="w-full max-w-3xl" height="h-4" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </header>

          <section className="space-y-4 rounded-2xl bg-secondary/20 px-5 py-5">
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

          <section className="space-y-4 rounded-2xl bg-secondary/20 px-5 py-5">
            <SkeletonText width="w-36" height="h-3" />
            <SkeletonText width="w-56" height="h-7" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl bg-secondary/20 px-5 py-5">
            <SkeletonText width="w-28" height="h-3" />
            <SkeletonText width="w-52" height="h-7" />
            <Skeleton className="h-56 w-full" />
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-6 rounded-2xl bg-secondary/20 px-5 py-5">
          <SkeletonText width="w-28" height="h-3" />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="h-9 w-9" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <SkeletonText width="w-32" height="h-4" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <SkeletonText width="w-20" height="h-3" />
                <SkeletonText width="w-28" height="h-3" />
              </div>
            </div>

            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-1.5">
                  <SkeletonText width="w-20" height="h-3" />
                  <SkeletonText width="w-28" height="h-4" />
                </div>
              ))}
            </div>
          </div>

          <SkeletonText width="w-full max-w-sm" height="h-3" />
          <SkeletonText width="w-full max-w-xs" height="h-3" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </aside>
      </div>
    </main>
  );
}
