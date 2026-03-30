"use client";

import { memo, forwardRef, useId, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible checkbox component with indeterminate state support
 * @param {boolean|"indeterminate"} props.checked - Checked state
 * @param {function} props.onCheckedChange - Callback when checked state changes
 * @param {boolean} props.disabled - Whether checkbox is disabled
 * @param {string} props.id - Custom id
 * @param {string} props.name - Form field name
 * @param {string} props.value - Form field value
 * @param {string} props.label - Label text
 * @param {string} props.description - Description text below label
 * @param {string} props.error - Error message
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.className - Additional CSS classes
 */
const Checkbox = memo(
  forwardRef(function Checkbox(
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      id: propId,
      name,
      value,
      label,
      description,
      error,
      required = false,
      className,
      ...props
    },
    ref
  ) {
    const generatedId = useId();
    const checkboxId = propId || generatedId;
    const descriptionId = `${checkboxId}-description`;
    const errorId = `${checkboxId}-error`;

    const isChecked = checked === true;
    const isIndeterminate = checked === "indeterminate";

    const handleClick = useCallback(() => {
      if (disabled) return;
      if (isIndeterminate) {
        onCheckedChange?.(true);
      } else {
        onCheckedChange?.(!isChecked);
      }
    }, [disabled, isIndeterminate, isChecked, onCheckedChange]);

    const handleKeyDown = useCallback(
      (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleClick();
        }
      },
      [handleClick]
    );

    const ariaDescribedBy = [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("flex items-start gap-3", className)} {...props}>
        {/* Hidden native input for form compatibility */}
        <input
          type="checkbox"
          ref={ref}
          id={checkboxId}
          name={name}
          value={value}
          checked={isChecked}
          disabled={disabled}
          required={required}
          onChange={() => onCheckedChange?.(!isChecked)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Styled checkbox overlay */}
        <div
          role="checkbox"
          aria-checked={isIndeterminate ? "mixed" : isChecked}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={ariaDescribedBy || undefined}
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "peer size-4 shrink-0 rounded-md border border-border bg-background transition-all duration-150 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "flex items-center justify-center",
            (isChecked || isIndeterminate) && "bg-primary border-primary text-primary-foreground",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && "cursor-pointer"
          )}
        >
          {/* Check icon */}
          {isChecked && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3 animate-scale-in"
              aria-hidden="true"
            >
              <polyline points="4 12 9 17 20 7" />
            </svg>
          )}

          {/* Indeterminate icon */}
          {isIndeterminate && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              className="size-3 animate-scale-in"
              aria-hidden="true"
            >
              <line x1="6" y1="12" x2="18" y2="12" />
            </svg>
          )}
        </div>

        {/* Label & description */}
        {(label || description || error) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={checkboxId}
                className={cn(
                  "text-sm font-medium text-foreground cursor-pointer",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                {label}
                {required && (
                  <span className="text-destructive ml-0.5" aria-hidden="true">
                    *
                  </span>
                )}
              </label>
            )}
            {description && (
              <p id={descriptionId} className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
            {error && (
              <p id={errorId} className="text-xs text-destructive mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    );
  })
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
