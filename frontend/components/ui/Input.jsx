"use client";

import React, { useId, useState, useRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Enhanced accessible input component with premium UX features
 * @param {Object} props
 * @param {"text"|"email"|"password"|"number"|"file"|"tel"|"url"|"search"} props.type - Input type
 * @param {string} props.label - Label text (displays above input or floating)
 * @param {string} props.error - Error message (displays below input)
 * @param {string} props.hint - Hint text (displays below input, before error)
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.success - Success state
 * @param {string} props.className - Additional CSS classes
 * @param {"sm"|"md"|"lg"} props.size - Input size variant
 * @param {boolean} props.floatingLabel - Enable floating label animation
 * @param {React.ReactNode} props.iconLeft - Icon to display on the left
 * @param {React.ReactNode} props.iconRight - Icon to display on the right
 * @param {boolean} props.clearable - Show clear button when input has value
 * @param {number} props.maxLength - Maximum character length (shows counter)
 * @param {boolean} props.showCounter - Show character counter
 */
export default function Input({
  type = "text",
  label = "",
  error = "",
  hint = "",
  required = false,
  success = false,
  className = "",
  id: propId,
  size = "md",
  floatingLabel = false,
  iconLeft,
  iconRight,
  clearable = false,
  maxLength,
  showCounter = false,
  value: controlledValue,
  defaultValue,
  onChange,
  ...rest
}) {
  const generatedId = useId();
  const inputId = propId || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef(null);
  
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleChange = (e) => {
    if (controlledValue === undefined) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const handleClear = () => {
    // Create a more complete synthetic event object
    const syntheticEvent = {
      target: { value: "", name: rest.name || "" },
      currentTarget: { value: "", name: rest.name || "" },
      type: "change",
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    if (controlledValue === undefined) {
      setInternalValue("");
    }
    onChange?.(syntheticEvent);
    inputRef.current?.focus();
  };

  const sizeStyles = {
    sm: "h-8 px-2.5 py-1.5 text-xs",
    md: "h-9 px-3 py-2 text-sm",
    lg: "h-10 px-4 py-2.5 text-base",
  };

  const iconPadding = {
    sm: { left: iconLeft ? "pl-8" : "", right: iconRight || clearable ? "pr-8" : "" },
    md: { left: iconLeft ? "pl-9" : "", right: iconRight || clearable ? "pr-9" : "" },
    lg: { left: iconLeft ? "pl-10" : "", right: iconRight || clearable ? "pr-10" : "" },
  };

  const inputStyles = clsx(
    "w-full rounded-md border bg-card text-foreground transition-all duration-200",
    "placeholder:text-muted-foreground",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    sizeStyles[size],
    iconPadding[size].left,
    iconPadding[size].right,
    error
      ? "border-destructive focus-visible:outline-destructive focus-visible:ring-destructive/20"
      : success
      ? "border-success focus-visible:outline-success focus-visible:ring-success/20"
      : "border-border",
    !error && !success && "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary focus-visible:shadow-[0_0_0_3px_var(--ring),0_0_15px_-3px_var(--primary)]",
    error && hasInteracted && "animate-shake",
    className
  );

  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  const showCharCounter = showCounter || (maxLength && maxLength > 0);
  const charCount = value?.toString().length || 0;
  const isNearLimit = maxLength && charCount >= maxLength * 0.8;

  const inputElement = (
    <div className="relative">
      {/* Left Icon */}
      {iconLeft && (
        <div className={clsx(
          "absolute left-0 top-0 h-full flex items-center justify-center text-muted-foreground pointer-events-none",
          size === "sm" ? "w-8" : size === "lg" ? "w-10" : "w-9"
        )}>
          {iconLeft}
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type={type}
        className={inputStyles}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        value={value}
        onChange={handleChange}
        onBlur={() => setHasInteracted(true)}
        maxLength={maxLength}
        placeholder={floatingLabel ? " " : rest.placeholder}
        {...rest}
      />

      {/* Floating Label */}
      {floatingLabel && label && (
        <label
          htmlFor={inputId}
          className="floating-label"
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}

      {/* Right Icon or Clear Button */}
      {(iconRight || (clearable && value)) && (
        <div className={clsx(
          "absolute right-0 top-0 h-full flex items-center justify-center",
          size === "sm" ? "w-8" : size === "lg" ? "w-10" : "w-9"
        )}>
          {clearable && value ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              aria-label="Clear input"
              tabIndex={-1}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : iconRight ? (
            <div className="text-muted-foreground pointer-events-none">
              {iconRight}
            </div>
          ) : null}
        </div>
      )}

      {/* Success Icon */}
      {success && !iconRight && !clearable && (
        <div className={clsx(
          "absolute right-0 top-0 h-full flex items-center justify-center text-success pointer-events-none",
          size === "sm" ? "w-8" : size === "lg" ? "w-10" : "w-9"
        )}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );

  return (
    <div className="mb-3">
      {/* Standard Label (if not floating) */}
      {label && !floatingLabel && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Input with optional floating label container */}
      {floatingLabel ? (
        <div className="floating-label-container">{inputElement}</div>
      ) : (
        inputElement
      )}

      {/* Hint, Error, and Counter */}
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="flex-1 min-w-0">
          {hint && !error && (
            <p id={hintId} className="text-xs text-muted-foreground">
              {hint}
            </p>
          )}
          {error && (
            <p id={errorId} className="text-xs text-destructive animate-fade-in" role="alert">
              {error}
            </p>
          )}
        </div>
        {showCharCounter && (
          <p className={clsx(
            "text-xs shrink-0 transition-colors",
            isNearLimit ? "text-warning" : "text-muted-foreground",
            charCount === maxLength && "text-destructive font-medium"
          )}>
            {charCount}{maxLength ? `/${maxLength}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

Input.propTypes = {
  type: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  required: PropTypes.bool,
  success: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  floatingLabel: PropTypes.bool,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  clearable: PropTypes.bool,
  maxLength: PropTypes.number,
  showCounter: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
};
