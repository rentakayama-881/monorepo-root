import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function OrderDetailLoading() {
  return (
    <main className="container py-10 space-y-6" aria-busy="true" aria-live="polite">
      <header className="space-y-2">
        <SkeletonText width="w-24" height="h-3" />
        <SkeletonText width="w-48" height="h-7" />
        <SkeletonText width="w-72" />
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <SkeletonText width="w-full" height="h-5" />
        <SkeletonText width="w-full" height="h-5" />
        <SkeletonText width="w-3/4" height="h-5" />
        <SkeletonText width="w-1/2" height="h-5" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </main>
  );
}
