import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function ThreadDetailSkeleton({ threadId }) {
  return (
    <main
      className="mx-auto min-h-[calc(100dvh-var(--header-height))] max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <SkeletonText width="w-14" height="h-4" />
        <span>/</span>
        <SkeletonText width="w-24" height="h-4" />
        <span>/</span>
        <span className="text-foreground">{threadId ? `Thread #${threadId}` : "Thread"}</span>
      </nav>

      <article className="rounded-lg border border-border bg-card dark:bg-background">
        {/* Header */}
        <div className="border-b border-border p-6">
          <SkeletonText width="w-full max-w-2xl" height="h-7" />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-36 rounded-md" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image placeholder */}
          <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
            <div className="aspect-video w-full">
              <Skeleton className="h-full w-full rounded-none" />
            </div>
          </div>

          {/* Summary placeholder */}
          <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-4">
            <div className="space-y-2">
              <SkeletonText width="w-full" height="h-4" />
              <SkeletonText width="w-5/6" height="h-4" />
            </div>
          </div>

          {/* Body placeholder */}
          <div className="space-y-2">
            <SkeletonText width="w-full" height="h-4" />
            <SkeletonText width="w-full" height="h-4" />
            <SkeletonText width="w-11/12" height="h-4" />
            <SkeletonText width="w-full" height="h-4" />
            <SkeletonText width="w-10/12" height="h-4" />
            <SkeletonText width="w-full" height="h-4" />
            <SkeletonText width="w-9/12" height="h-4" />
            <SkeletonText width="w-11/12" height="h-4" />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/50 px-6 py-4">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="ml-auto h-9 w-24 rounded-md" />
        </div>
      </article>

      <div className="reading-progress" aria-hidden="true" />
    </main>
  );
}

