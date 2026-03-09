import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function NewValidationCaseSkeleton() {
  return (
    <main className="container min-h-screen py-5 md:py-10" aria-busy="true" aria-live="polite">
      <div className="mb-6">
        <SkeletonText width="w-52" height="h-4" />
        <SkeletonText width="w-80" height="h-8" className="mt-2" />
        <SkeletonText width="w-full max-w-3xl" height="h-4" className="mt-2" />
      </div>

      <div className="mb-4 rounded-2xl bg-secondary/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <SkeletonText width="w-36" height="h-3" />
            <SkeletonText width="w-72" height="h-4" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`nav-${i}`} className="h-7 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <div className="space-y-4 md:space-y-6 rounded-2xl bg-secondary/20 px-4 py-4 md:px-5 md:py-6">
        <div>
          <SkeletonText width="w-20" height="h-3" />
          <Skeleton className="mt-2 h-11 w-full rounded-xl" />
        </div>

        <div>
          <SkeletonText width="w-32" height="h-3" />
          <Skeleton className="mt-2 h-24 w-full rounded-xl" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <SkeletonText width="w-28" height="h-3" />
            <Skeleton className="mt-2 h-11 w-full rounded-xl" />
            <SkeletonText width="w-64" height="h-3" className="mt-2" />
          </div>
          <div>
            <SkeletonText width="w-16" height="h-3" />
            <Skeleton className="mt-2 h-28 w-full rounded-xl" />
          </div>
        </div>

        <div>
          <SkeletonText width="w-28" height="h-3" />
          <Skeleton className="mt-2 h-[360px] w-full rounded-2xl" />
          <SkeletonText width="w-full max-w-2xl" height="h-3" className="mt-2" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        <div className="space-y-3 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`tail-${i}`} className="h-4 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}
