import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function ValidationCaseRecordSkeleton() {
  return (
    <main className="container py-10" aria-busy="true" aria-live="polite">
      <div className="space-y-7">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SkeletonText width="w-12" height="h-4" />
          <SkeletonText width="w-24" height="h-4" />
          <SkeletonText width="w-20" height="h-4" />
        </div>

        <header className="space-y-3">
          <SkeletonText width="w-44" height="h-3" />
          <SkeletonText width="w-full max-w-2xl" height="h-10" />
          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <SkeletonText width="w-16" height="h-3" />
              <SkeletonText width="w-28" height="h-5" />
            </div>
            <div className="space-y-2">
              <SkeletonText width="w-16" height="h-3" />
              <SkeletonText width="w-28" height="h-5" />
            </div>
            <div className="space-y-2">
              <SkeletonText width="w-16" height="h-3" />
              <SkeletonText width="w-36" height="h-5" />
            </div>
            <div className="space-y-2">
              <SkeletonText width="w-16" height="h-3" />
              <div className="flex items-center gap-2">
                <SkeletonCircle size="h-7 w-7" />
                <SkeletonText width="w-32" height="h-5" />
              </div>
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
        </header>

        <section className="space-y-3 border-t border-border pt-8">
          <SkeletonText width="w-28" height="h-3" />
          <SkeletonText width="w-44" height="h-7" />
          <Skeleton className="h-72 w-full" />
        </section>
      </div>
    </main>
  );
}

