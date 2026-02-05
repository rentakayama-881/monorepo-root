import Link from "next/link";
import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";
import { ThreadCardSkeleton } from "@/components/ui/ThreadCard";

export default function CategoryThreadsSkeleton({
  slug,
  locked = false,
  threadCount = 8,
}) {
  const chipWidths = ["w-16", "w-20", "w-24", "w-14", "w-28", "w-12"];

  return (
    <main
      className="mx-auto min-h-[calc(100dvh-var(--header-height))] max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-full max-w-sm" height="h-7" />
          <SkeletonText width="w-full max-w-md" height="h-4" />
          <SkeletonText width="w-40" height="h-3" />
        </div>

        <div className="shrink-0">
          {locked ? (
            <div
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground"
              title="Kategori ini sementara ditutup untuk thread baru"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Kategori Terkunci
            </div>
          ) : slug ? (
            <Link
              href={`/category/${slug}/new`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Buat Thread
            </Link>
          ) : (
            <Skeleton className="h-10 w-36 rounded-md" />
          )}
        </div>
      </header>

      {/* Tag Filter skeleton (reserve layout to avoid footer jump) */}
      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonText width="w-20" height="h-4" />
          <div className="flex flex-wrap gap-2">
            {chipWidths.map((width, index) => (
              <Skeleton key={index} className={`h-8 ${width} rounded-full`} />
            ))}
          </div>
          <div className="ml-auto hidden sm:block">
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
        </div>
        <SkeletonText width="w-56" height="h-3" className="mt-2" />
      </section>

      <div className="space-y-4">
        {Array.from({ length: threadCount }).map((_, index) => (
          <ThreadCardSkeleton key={index} variant="default" />
        ))}
      </div>
    </main>
  );
}
