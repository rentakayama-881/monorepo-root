import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export function ValidationCaseIndexContentSkeleton({ fullHeight = false }) {
  return (
    <section className={fullHeight ? "min-h-[68vh] space-y-6" : "space-y-6"}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="md:col-span-8">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="md:col-span-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>

      <div className="rounded-2xl bg-secondary/20 px-4 py-4">
        <div className="mb-3 grid grid-cols-7 gap-4 pb-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`head-${i}`} className="h-4 w-24" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 9 }).map((_, row) => (
            <div key={`row-${row}`} className="grid grid-cols-7 gap-4 py-2">
              {Array.from({ length: 7 }).map((__, col) => (
                <Skeleton key={`cell-${row}-${col}`} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ValidationCaseIndexSkeleton() {
  return (
    <main className="container min-h-screen py-10" aria-busy="true" aria-live="polite">
      <header className="mb-8">
        <SkeletonText width="w-28" height="h-3" />
        <SkeletonText width="w-80" height="h-9" className="mt-3" />
        <SkeletonText width="w-full max-w-3xl" height="h-4" className="mt-3" />
      </header>

      <ValidationCaseIndexContentSkeleton fullHeight />
    </main>
  );
}
