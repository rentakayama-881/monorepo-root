import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function ValidationCaseIndexLoading() {
  return (
    <main className="container py-10">
      <header className="mb-6">
        <SkeletonText width="w-28" height="h-3" />
        <SkeletonText width="w-80" height="h-8" className="mt-3" />
        <SkeletonText width="w-full max-w-3xl" height="h-4" className="mt-3" />
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <Skeleton className="h-[38px] w-full" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-[38px] w-full" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-[38px] w-full" />
        </div>
        <div className="md:col-span-9">
          <Skeleton className="h-[38px] w-full" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-[38px] w-full" />
        </div>
      </section>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-6 gap-4 border-b border-border bg-secondary/60 px-4 py-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-32" />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, row) => (
              <div key={row} className="grid grid-cols-6 gap-4 px-4 py-4">
                {Array.from({ length: 6 }).map((__, col) => (
                  <Skeleton key={col} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

