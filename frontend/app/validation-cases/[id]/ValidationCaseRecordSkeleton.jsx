import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";
import WorkspaceWorkflowSkeleton from "./WorkspaceWorkflowSkeleton";

function BreadcrumbSkeleton() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <SkeletonText width="w-12" height="h-4" />
      <SkeletonText width="w-24" height="h-4" />
      <SkeletonText width="w-20" height="h-4" />
    </div>
  );
}

function BountySummarySkeleton() {
  return (
    <div className="w-full rounded-[var(--radius)] border border-border/70 bg-background px-4 py-4 lg:max-w-xs">
      <SkeletonText width="w-12" height="h-3" />
      <div className="mt-1">
        <SkeletonText width="w-32" height="h-7" />
      </div>
      <div className="mt-2 space-y-2">
        <SkeletonText width="w-full max-w-[11rem]" height="h-3" />
        <SkeletonText width="w-full max-w-[9rem]" height="h-3" />
      </div>
    </div>
  );
}

function StandardHeaderSkeleton() {
  return (
    <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <SkeletonText width="w-20" height="h-3" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <SkeletonText width="w-14" height="h-3" />
              <SkeletonText width="w-28" height="h-3" />
            </div>
          </div>

          <div className="space-y-2">
            <SkeletonText width="w-full max-w-2xl" height="h-7" />
            <SkeletonText width="w-full max-w-3xl" height="h-4" />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SkeletonText width="w-20" height="h-3" />
            <SkeletonText width="w-16" height="h-3" />
            <SkeletonText width="w-24" height="h-3" />
          </div>
        </div>

        <BountySummarySkeleton />
      </div>
    </section>
  );
}

function WorkspaceHeaderSkeleton() {
  return (
    <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="space-y-2">
            <SkeletonText width="w-20" height="h-3" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <SkeletonText width="w-14" height="h-3" />
              <SkeletonText width="w-28" height="h-3" />
            </div>
          </div>

          <div className="space-y-2">
            <SkeletonText width="w-full max-w-2xl" height="h-7" />
            <SkeletonText width="w-full max-w-3xl" height="h-4" />
            <SkeletonText width="w-full max-w-xl" height="h-4" />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SkeletonText width="w-20" height="h-3" />
            <SkeletonText width="w-16" height="h-3" />
            <SkeletonText width="w-24" height="h-3" />
          </div>
        </div>

        <BountySummarySkeleton />
      </div>
    </section>
  );
}

function GenericHeaderSkeleton() {
  return (
    <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <SkeletonText width="w-20" height="h-3" />
            <SkeletonText width="w-28" height="h-3" />
          </div>
          <div className="space-y-2">
            <SkeletonText width="w-full max-w-2xl" height="h-7" />
            <SkeletonText width="w-full max-w-3xl" height="h-4" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonText width="w-24" height="h-3" />
            <SkeletonText width="w-20" height="h-3" />
            <SkeletonText width="w-28" height="h-3" />
          </div>
        </div>

        <BountySummarySkeleton />
      </div>
    </section>
  );
}

function StandardMainSkeleton() {
  return (
    <>
      <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
        <SkeletonText width="w-32" height="h-5" />
        <div className="overflow-hidden rounded-[var(--radius)] border border-border/70 bg-background">
          <div className="space-y-2 border-b border-border/70 bg-secondary/35 px-4 py-3">
            <SkeletonText width="w-24" height="h-3" />
            <SkeletonText width="w-full max-w-sm" height="h-3" />
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="space-y-3 rounded-[var(--radius)] border border-border/70 bg-card p-3"
              >
                <SkeletonText width="w-24" height="h-3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-20 w-full rounded-[var(--radius)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
        <SkeletonText width="w-44" height="h-5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <SkeletonText width="w-16" height="h-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
          <div className="space-y-3 md:border-l md:border-border md:pl-6">
            <Skeleton className="h-9 w-40 rounded-[var(--radius)]" />
            <SkeletonText width="w-full max-w-xs" height="h-3" />
            <Skeleton className="h-px w-full" />
            <SkeletonText width="w-24" height="h-3" />
            <Skeleton className="h-9 w-44 rounded-[var(--radius)]" />
            <SkeletonText width="w-32" height="h-3" />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
        <SkeletonText width="w-32" height="h-5" />
        <div className="space-y-4 rounded-[var(--radius)] border border-border/70 bg-background p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <SkeletonText width="w-28" height="h-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-20 w-full rounded-[var(--radius)]" />
            </div>
            <div className="space-y-3">
              <SkeletonText width="w-32" height="h-4" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-[var(--radius)]" />
                ))}
              </div>
              <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-3 border-b border-border pb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 w-full" />
              ))}
            </div>
            {Array.from({ length: 2 }).map((_, row) => (
              <div key={row} className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((__, col) => (
                  <Skeleton key={col} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
        <SkeletonText width="w-28" height="h-5" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative border-l border-border pl-5">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-border" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function StandardSidebarSkeleton() {
  return (
    <>
      <section className="space-y-5 rounded-[var(--radius)] border bg-card p-5">
        <SkeletonText width="w-20" height="h-3" />

        <div className="flex items-center gap-3">
          <SkeletonCircle size="h-9 w-9" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonText width="w-28" height="h-4" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <SkeletonText width="w-20" height="h-3" />
            <SkeletonText width="w-28" height="h-3" />
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-border/70 bg-background px-4 py-4">
          <SkeletonText width="w-12" height="h-3" />
          <div className="mt-1">
            <SkeletonText width="w-32" height="h-7" />
          </div>
          <div className="mt-2 space-y-2">
            <SkeletonText width="w-full max-w-[11rem]" height="h-3" />
            <SkeletonText width="w-full max-w-[9rem]" height="h-3" />
          </div>
        </div>

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <SkeletonText width="w-16" height="h-3" />
              <div className="space-y-2 text-right">
                <SkeletonText width="w-24" height="h-3" />
                {i === 1 || i === 2 ? <Skeleton className="ml-auto h-5 w-16 rounded-full" /> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-[var(--radius)] border bg-card p-5">
        <SkeletonText width="w-full max-w-sm" height="h-3" />
        <SkeletonText width="w-full max-w-xs" height="h-3" />
      </section>
    </>
  );
}

function GenericBodySkeleton() {
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
        <div className="space-y-3 rounded-[var(--radius)] border border-border/70 bg-background p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
            <SkeletonText width="w-28" height="h-5" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-16 w-full rounded-[var(--radius)]" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StandardLayoutSkeleton() {
  return (
    <div className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
      <div className="space-y-6 lg:col-span-8">
        <StandardHeaderSkeleton />
        <StandardMainSkeleton />
      </div>

      <aside className="h-fit space-y-6 lg:sticky lg:top-24 lg:col-span-4">
        <StandardSidebarSkeleton />
      </aside>
    </div>
  );
}

function WorkspaceLayoutSkeleton() {
  return (
    <div className="space-y-6">
      <WorkspaceHeaderSkeleton />
      <WorkspaceWorkflowSkeleton />
    </div>
  );
}

function GenericLayoutSkeleton() {
  return (
    <div className="space-y-6">
      <GenericHeaderSkeleton />
      <GenericBodySkeleton />
    </div>
  );
}

export default function ValidationCaseRecordSkeleton({ variant = "standard" }) {
  let content = <StandardLayoutSkeleton />;

  if (variant === "workspace") {
    content = <WorkspaceLayoutSkeleton />;
  } else if (variant === "generic") {
    content = <GenericLayoutSkeleton />;
  }

  return (
    <main className="container min-h-screen py-10" aria-busy="true" aria-live="polite">
      <BreadcrumbSkeleton />
      {content}
    </main>
  );
}
