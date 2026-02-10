import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function UserProfileLoading() {
  return (
    <main className="container py-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <SkeletonCircle size="h-16 w-16" />
          <div className="space-y-2">
            <SkeletonText width="w-56" height="h-7" />
            <SkeletonText width="w-40" height="h-4" />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:w-80">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>

      <div className="mt-8">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-6 gap-4 border-b border-border bg-secondary/60 px-4 py-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-32" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, row) => (
                <div key={row} className="grid grid-cols-6 gap-4 px-4 py-4">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <Skeleton key={col} className="h-4 w-full" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

