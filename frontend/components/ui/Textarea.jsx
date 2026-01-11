"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Enhanced textarea component with auto-resize and premium features
 * @param {string} props.label - Label text (optional, tampil di atas textarea)
 * @param {string} props.error - Error message (optional, tampil di bawah textarea)
 * @param {string} props.hint - Hint text (displays below textarea, before error)
 * @param {number} props.rows - Default rows (default 4)
 * @param {number} props.minRows - Minimum rows for auto-resize
 * @param {number} props.maxRows - Maximum rows for auto-resize
 * @param {boolean} props.autoResize - Enable auto-resize functionality
 * @param {number} props.maxLength - Maximum character length (shows counter)
 * @param {boolean} props.showCounter - Show character counter
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.success - Success state
 * @param {string} props.className - Additional CSS classes
 */
export default function Textarea({
  label = "",
  error = "",
  hint = "",
  rows = 4,
  minRows = 3,
  maxRows = 10,
  autoResize = false,
  maxLength,
  showCounter = false,
  required = false,
  success = false,
  className = "",
  id: propId,
  value: controlledValue,
  defaultValue,
  onChange,
  ...rest
}) {
  const generatedId = useId();
  const textareaId = propId || generatedId;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;
  const textareaRef = useRef(null);
  
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const [hasInteracted, setHasInteracted] = useState(false);

  const handleChange = (e) => {
    if (controlledValue === undefined) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);

    // Auto-resize
    if (autoResize && textareaRef.current) {
      adjustHeight();
    }
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeightValue = computedStyle.lineHeight;
    
    // Handle 'normal' or other non-numeric lineHeight values
    const lineHeight = lineHeightValue === 'normal' 
      ? parseInt(computedStyle.fontSize) * 1.2 
      : parseFloat(lineHeightValue);
    
    // Ensure we have a valid number
    if (isNaN(lineHeight)) return;
    
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    if (autoResize) {
      adjustHeight();
    }
  }, [value, autoResize]);

  const textareaStyles = clsx(
    "w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground transition-all duration-200",
    "placeholder:text-muted-foreground",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "custom-scrollbar",
    autoResize ? "resize-none overflow-hidden" : "resize-y min-h-[80px]",
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

  return (
    <div className="mb-3">
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          id={textareaId}
          rows={autoResize ? minRows : rows}
          className={textareaStyles}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          value={value}
          onChange={handleChange}
          onBlur={() => setHasInteracted(true)}
          maxLength={maxLength}
          {...rest}
        />

        {/* Success Icon */}
        {success && (
          <div className="absolute right-3 top-3 text-success pointer-events-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

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

Textarea.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  rows: PropTypes.number,
  minRows: PropTypes.number,
  maxRows: PropTypes.number,
  autoResize: PropTypes.bool,
  maxLength: PropTypes.number,
  showCounter: PropTypes.bool,
  required: PropTypes.bool,
  success: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  onChange: PropTypes.func,
};
