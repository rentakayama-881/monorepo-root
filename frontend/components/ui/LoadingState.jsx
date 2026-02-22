import { cn } from "@/lib/utils";
import Skeleton from "./Skeleton";

export function CenteredSpinner({
  className = "",
  sizeClass = "h-7 w-7",
  srLabel = "Loading",
}) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-border border-t-primary",
          sizeClass
        )}
      />
      <span className="sr-only">{srLabel}</span>
    </div>
  );
}

export function SectionLoadingBlock({
  className = "",
  lines = 3,
  compact = false,
  srLabel = "Loading",
}) {
  const widthCycle = ["w-full", "w-11/12", "w-4/5", "w-3/5"];
  const safeLines = Math.max(1, Number(lines) || 1);

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-border bg-card",
        compact ? "p-3" : "p-4",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={cn("space-y-2", compact ? "pt-0.5" : "pt-1")}>
        {Array.from({ length: safeLines }).map((_, idx) => (
          <Skeleton
            key={`${safeLines}-${idx}`}
            className={cn(compact ? "h-3" : "h-3.5", widthCycle[idx % widthCycle.length])}
          />
        ))}
      </div>
      <span className="sr-only">{srLabel}</span>
    </div>
  );
}

export function PageLoadingBlock({
  className = "",
  maxWidthClass = "max-w-xl",
  lines = 4,
  srLabel = "Loading",
}) {
  return (
    <div className={cn("min-h-[50vh] p-4", className)}>
      <div className={cn("mx-auto w-full", maxWidthClass)}>
        <div className="space-y-4">
          <CenteredSpinner srLabel={srLabel} />
          <SectionLoadingBlock lines={lines} srLabel={srLabel} />
        </div>
      </div>
    </div>
  );
}
