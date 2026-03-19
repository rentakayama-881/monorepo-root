import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function AccountLoading() {
  return (
    <main
      className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-8">
        <SkeletonText width="w-56" height="h-8" />
        <SkeletonText width="w-72" className="mt-2" />
      </div>

      <div className="space-y-10">
        {/* Profile section */}
        <div className="rounded-[var(--radius)] border border-border bg-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton shape="circle" className="h-16 w-16" />
            <div className="flex-1 space-y-2">
              <SkeletonText width="w-32" height="h-5" />
              <SkeletonText width="w-48" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Finance section */}
        <div className="rounded-[var(--radius)] border border-border bg-card p-6">
          <SkeletonText width="w-24" height="h-5" className="mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Security section */}
        <div className="rounded-[var(--radius)] border border-border bg-card p-6">
          <SkeletonText width="w-28" height="h-5" className="mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
