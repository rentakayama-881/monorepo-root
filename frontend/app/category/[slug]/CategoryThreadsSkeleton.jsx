import Link from "next/link";
import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function CategoryValidationCasesSkeleton({ slug, locked = false, rowCount = 10 }) {
  const colWidths = ["w-24", "w-56", "w-24", "w-28", "w-28", "w-24"];

  return (
    <main
      className="container py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-full max-w-sm" height="h-7" />
          <SkeletonText width="w-full max-w-md" height="h-4" />
        </div>

        <div className="shrink-0">
          {locked ? (
            <div
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground"
              title="Intake ditutup"
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
              Intake closed
            </div>
          ) : slug ? (
            <Link
              href={`/category/${slug}/new`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
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
              Create Validation Case
            </Link>
          ) : (
            <Skeleton className="h-10 w-36 rounded-md" />
          )}
        </div>
      </header>

      <section className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-7 gap-4 border-b border-border bg-secondary/60 px-4 py-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className={`h-4 ${colWidths[i % colWidths.length]} rounded`} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rowCount }).map((_, idx) => (
              <div key={idx} className="grid grid-cols-7 gap-4 px-4 py-4">
                {Array.from({ length: 7 }).map((__, j) => (
                  <Skeleton key={j} className={`h-4 ${colWidths[j % colWidths.length]} rounded`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
