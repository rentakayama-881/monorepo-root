"use client";

import { memo, forwardRef, useId, useCallback } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const trackVariants = cva(
  "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const thumbVariants = cva(
  "pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
  {
    variants: {
      size: {
        sm: "size-4",
        md: "size-5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * Accessible switch / toggle component
 * @param {boolean} props.checked - Whether switch is on
 * @param {function} props.onCheckedChange - Callback when toggled
 * @param {boolean} props.disabled - Whether switch is disabled
 * @param {string} props.id - Custom id
 * @param {string} props.name - Form field name
 * @param {string} props.label - Label text
 * @param {string} props.description - Description text below label
 * @param {"sm"|"md"} props.size - Switch size
 * @param {string} props.className - Additional CSS classes
 */
const Switch = memo(
  forwardRef(function Switch(
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      id: propId,
      name,
      label,
      description,
      size = "md",
      className,
      ...props
    },
    ref
  ) {
    const generatedId = useId();
    const switchId = propId || generatedId;

    const handleClick = useCallback(() => {
      if (disabled) return;
      onCheckedChange?.(!checked);
    }, [disabled, checked, onCheckedChange]);

    const handleKeyDown = useCallback(
      (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleClick();
        }
      },
      [handleClick]
    );

    const translateClass =
      size === "sm"
        ? checked
          ? "translate-x-4"
          : "translate-x-0"
        : checked
          ? "translate-x-5"
          : "translate-x-0";

    const switchControl = (
      <>
        {/* Hidden native input for form compatibility */}
        <input
          type="checkbox"
          ref={ref}
          id={switchId}
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={() => onCheckedChange?.(!checked)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Styled switch track */}
        <div
          role="switch"
          aria-checked={checked}
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            trackVariants({ size }),
            checked ? "bg-primary" : "bg-muted-foreground/20",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && "cursor-pointer"
          )}
        >
          {/* Sliding thumb */}
          <span className={cn(thumbVariants({ size }), translateClass)} aria-hidden="true" />
        </div>
      </>
    );

    // Without label, render switch only
    if (!label && !description) {
      return (
        <div className={cn("inline-flex", className)} {...props}>
          {switchControl}
        </div>
      );
    }

    // With label, render full layout
    return (
      <div className={cn("flex items-center justify-between gap-3", className)} {...props}>
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                "text-sm font-medium text-foreground",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={cn("text-xs text-muted-foreground", disabled && "opacity-50")}>
              {description}
            </p>
          )}
        </div>
        {switchControl}
      </div>
    );
  })
);

Switch.displayName = "Switch";

export default Switch;
