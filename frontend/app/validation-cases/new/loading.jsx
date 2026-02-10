import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function NewValidationCaseLoading() {
  return (
    <main className="container py-10">
      <div className="mb-6">
        <SkeletonText width="w-52" height="h-4" />
        <SkeletonText width="w-80" height="h-8" className="mt-3" />
        <SkeletonText width="w-full max-w-3xl" height="h-4" className="mt-3" />
      </div>

      <div className="space-y-5">
        <div>
          <SkeletonText width="w-20" height="h-3" />
          <Skeleton className="mt-2 h-[38px] w-full" />
        </div>

        <div>
          <SkeletonText width="w-32" height="h-3" />
          <Skeleton className="mt-2 h-[84px] w-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <SkeletonText width="w-28" height="h-3" />
            <Skeleton className="mt-2 h-[38px] w-full" />
            <SkeletonText width="w-64" height="h-3" className="mt-2" />
          </div>
          <div>
            <SkeletonText width="w-16" height="h-3" />
            <Skeleton className="mt-2 h-[120px] w-full" />
          </div>
        </div>

        <div>
          <SkeletonText width="w-28" height="h-3" />
          <Skeleton className="mt-2 h-[340px] w-full" />
          <SkeletonText width="w-full max-w-2xl" height="h-3" className="mt-2" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-52" />
        </div>
      </div>
    </main>
  );
}

