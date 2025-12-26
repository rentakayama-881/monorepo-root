import clsx from "clsx";

/**
 * Base skeleton component with pulse animation
 */
export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx("animate-pulse rounded-md bg-[rgb(var(--surface-2))]", className)}
      {...props}
    />
  );
}

/**
 * Text line skeleton
 */
export function SkeletonText({ width = "w-full", height = "h-4", className = "" }) {
  return (
    <div className={clsx("bg-[rgb(var(--border))] rounded", width, height, className)} />
  );
}

/**
 * Circle skeleton (for avatars)
 */
export function SkeletonCircle({ size = "h-10 w-10", className = "" }) {
  return (
    <div className={clsx("bg-[rgb(var(--border))] rounded-full", size, className)} />
  );
}

/**
 * List item skeleton
 */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-[rgb(var(--border))] last:border-b-0 animate-pulse">
      <SkeletonCircle />
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-1/2" />
        <SkeletonText width="w-1/3" height="h-3" />
      </div>
      <SkeletonText width="w-20" />
    </div>
  );
}

/**
 * Transaction list skeleton
 */
export function SkeletonTransactionList({ count = 3 }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] divide-y divide-[rgb(var(--border))]">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/**
 * Balance card skeleton
 */
export function SkeletonBalanceCard() {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 animate-pulse">
      <SkeletonText width="w-24" height="h-4" />
      <SkeletonText width="w-40" height="h-10" className="mt-2" />
      <div className="flex gap-3 mt-4">
        <SkeletonText width="w-24" height="h-10" />
        <SkeletonText width="w-24" height="h-10" />
      </div>
    </div>
  );
}

/**
 * Page loading skeleton
 */
export function SkeletonPage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
      <div className="mx-auto max-w-2xl px-4 py-8 animate-pulse">
        <div className="mb-6">
          <SkeletonText width="w-48" height="h-8" />
          <SkeletonText width="w-64" height="h-4" className="mt-2" />
        </div>
        <SkeletonBalanceCard />
        <div className="mt-6">
          <SkeletonTransactionList count={5} />
        </div>
      </div>
    </main>
  );
}
