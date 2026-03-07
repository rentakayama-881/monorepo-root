import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export function ValidationCaseIndexContentSkeleton({ fullHeight = false }) {
  return (
    <section className={fullHeight ? "min-h-[68vh] space-y-6" : "space-y-6"}>
      {/* Filter skeleton */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <Skeleton className="h-4 w-10 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-4 w-12 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-4 w-16 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-9">
          <Skeleton className="h-4 w-8 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-3 flex items-end">
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
      </div>

      <Skeleton className="h-4 w-40" />

      {/* Card grid skeleton — matches final card layout */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius)] border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <SkeletonText width="w-3/4" height="h-4" />
              <Skeleton className="h-5 w-14 rounded-full shrink-0" />
            </div>
            <div className="flex items-center justify-between">
              <SkeletonText width="w-24" height="h-4" />
              <SkeletonText width="w-16" height="h-3" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <div className="flex items-center gap-2 border-t pt-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <SkeletonText width="w-20" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ValidationCaseIndexSkeleton() {
  return (
    <main className="container min-h-screen py-10" aria-busy="true" aria-live="polite">
      <header className="mb-6">
        <SkeletonText width="w-64" height="h-7" />
        <SkeletonText width="w-full max-w-xl" height="h-4" className="mt-2" />
      </header>

      <ValidationCaseIndexContentSkeleton fullHeight />
    </main>
  );
}
