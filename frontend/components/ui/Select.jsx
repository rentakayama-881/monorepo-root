import React from "react";
import PropTypes from "prop-types";

/**
 * Select dropdown generik:
 * - label: string (optional, tampil di atas select)
 * - error: string (optional, tampil di bawah select)
 * - options: array of { value, label } atau array of strings
 * - placeholder: string (optional, option pertama yang disabled)
 * - ...rest: props lain (value, onChange, dsb)
 */
export default function Select({
  label = "",
  error = "",
  options = [],
  placeholder = "",
  className = "",
  ...rest
}) {
  const selectStyles =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))] appearance-none cursor-pointer";

  // Normalize options to { value, label } format
  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  return (
    <div className="mb-3">
      {label && (
        <label className="mb-1 block text-sm font-medium text-[rgb(var(--fg))]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`${selectStyles} ${error ? "border-red-500" : ""} ${className}`}
          aria-invalid={!!error}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className="h-4 w-4 text-[rgb(var(--muted))]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        value: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
      }),
    ])
  ),
  placeholder: PropTypes.string,
  className: PropTypes.string,
};
