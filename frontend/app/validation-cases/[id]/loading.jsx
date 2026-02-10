import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function ValidationCaseRecordLoading() {
  return (
    <main className="container py-10">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <SkeletonText width="w-12" height="h-4" />
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonText width="w-20" height="h-4" />
      </div>

      <div className="space-y-7">
        <header className="space-y-3">
          <SkeletonText width="w-40" height="h-3" />
          <SkeletonText width="w-full max-w-2xl" height="h-10" />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Skeleton className="h-7 w-36 rounded-full" />
            <Skeleton className="h-7 w-44 rounded-full" />
            <Skeleton className="h-7 w-40 rounded-full" />
            <div className="flex items-center gap-2">
              <SkeletonCircle size="h-7 w-7" />
              <SkeletonText width="w-28" height="h-4" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
        </header>

        <section className="space-y-2">
          <SkeletonText width="w-32" height="h-3" />
          <SkeletonText width="w-56" height="h-7" />
          <Skeleton className="h-72 w-full" />
        </section>

        <section className="space-y-2">
          <SkeletonText width="w-40" height="h-3" />
          <SkeletonText width="w-60" height="h-7" />
          <Skeleton className="h-48 w-full" />
        </section>
      </div>
    </main>
  );
}

