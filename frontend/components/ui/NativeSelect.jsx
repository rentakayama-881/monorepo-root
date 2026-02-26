"use client";

import { cn } from "@/lib/utils";

export default function NativeSelect({
  options = [],
  wrapperClassName = "",
  className = "",
  children,
  ...props
}) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        {...props}
        className={cn(
          "h-11 w-full appearance-none rounded-[var(--radius)] border border-input bg-card px-3 pr-10 text-sm text-foreground shadow-sm transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {Array.isArray(options) && options.length > 0
          ? options.map((option) => {
              if (option == null) return null;
              if (typeof option === "string") {
                return (
                  <option key={option} value={option}>
                    {option}
                  </option>
                );
              }
              return (
                <option key={String(option.value)} value={option.value} disabled={Boolean(option.disabled)}>
                  {option.label}
                </option>
              );
            })
          : children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
