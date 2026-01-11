import React, { useId } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Accessible input component with label and error handling
 * @param {Object} props
 * @param {"text"|"email"|"password"|"number"|"file"|"tel"|"url"|"search"} props.type - Input type
 * @param {string} props.label - Label text (displays above input)
 * @param {string} props.error - Error message (displays below input)
 * @param {string} props.hint - Hint text (displays below input, before error)
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.className - Additional CSS classes
 */
export default function Input({
  type = "text",
  label = "",
  error = "",
  hint = "",
  required = false,
  className = "",
  id: propId,
  ...rest
}) {
  // Generate unique ID for accessibility
  const generatedId = useId();
  const inputId = propId || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const inputStyles = clsx(
    "w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    error ? "border-destructive" : "",
    className
  );

  // Build aria-describedby from hint and error
  const describedBy = [
    hint && hintId,
    error && errorId,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <div className="mb-3">
      {label && (
        <label 
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={inputStyles}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

Input.propTypes = {
  type: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
};
