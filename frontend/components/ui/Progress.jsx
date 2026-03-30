"use client";

import { memo, useMemo } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const trackVariants = cva("w-full overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const indicatorVariants = cva("h-full rounded-full transition-all duration-500 ease-out", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/**
 * Accessible progress bar component
 * @param {number} props.value - Current progress value
 * @param {number} props.max - Maximum value
 * @param {"sm"|"md"|"lg"} props.size - Bar height size
 * @param {"default"|"success"|"warning"|"danger"} props.variant - Color variant
 * @param {boolean} props.showLabel - Whether to show percentage label
 * @param {string} props.label - Accessible label text
 * @param {boolean} props.indeterminate - Indeterminate loading state
 * @param {string} props.className - Additional CSS classes
 */
const Progress = memo(function Progress({
  value = 0,
  max = 100,
  size = "md",
  variant = "default",
  showLabel = false,
  label,
  indeterminate = false,
  className,
  ...props
}) {
  const percentage = useMemo(() => {
    const clamped = Math.min(Math.max(value, 0), max);
    return max > 0 ? Math.round((clamped / max) * 100) : 0;
  }, [value, max]);

  return (
    <div className={cn("w-full", className)} {...props}>
      {/* Label row */}
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          {showLabel && (
            <span className="text-xs text-muted-foreground text-right">
              {indeterminate ? "..." : `${percentage}%`}
            </span>
          )}
        </div>
      )}

      {/* Progress track */}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : percentage}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `Progress: ${percentage}%`}
        className={trackVariants({ size })}
      >
        {/* Indicator bar */}
        <div
          className={cn(
            indicatorVariants({ variant }),
            indeterminate && "animate-progress-indeterminate w-1/3"
          )}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});

Progress.displayName = "Progress";

export default Progress;
