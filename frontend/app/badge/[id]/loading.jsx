import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function BadgeDetailLoading() {
  return (
    <div className="max-w-2xl" aria-busy="true" aria-live="polite">
      <SkeletonText width="w-40" height="h-7" />
      <div className="mt-3 rounded-lg border border-border bg-card p-4 space-y-3">
        <SkeletonText width="w-48" />
        <SkeletonText width="w-64" />
        <SkeletonText width="w-36" />
      </div>
    </div>
  );
}
