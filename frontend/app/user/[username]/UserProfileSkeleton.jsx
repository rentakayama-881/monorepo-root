import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function UserProfileSkeleton() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-6" aria-busy="true" aria-live="polite">
      {/* Profile Header Skeleton */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-start gap-4">
          <SkeletonCircle size="h-20 w-20" />
          <div className="min-w-0 flex-1 pt-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SkeletonText width="w-48" height="h-7" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonText width="w-40" height="h-4" />
            <SkeletonText width="w-32" height="h-4" />
          </div>
        </div>

        <Skeleton className="h-12 w-full rounded-md" />

        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-border mb-6 pb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Content Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-lg border border-border" />
        <Skeleton className="h-20 w-full rounded-lg border border-border" />
      </div>
    </section>
  );
}
