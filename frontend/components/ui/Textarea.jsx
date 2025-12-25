import React from "react";
import PropTypes from "prop-types";

/**
 * Textarea generik:
 * - label: string (optional, tampil di atas textarea)
 * - error: string (optional, tampil di bawah textarea)
 * - rows: number (default 4)
 * - ...rest: props lain (value, onChange, placeholder, aria-label, dsb)
 */
export default function Textarea({
  label = "",
  error = "",
  rows = 4,
  className = "",
  ...rest
}) {
  const textareaStyles =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))] resize-y min-h-[80px]";

  return (
    <div className="mb-3">
      {label && (
        <label className="mb-1 block text-sm font-medium text-[rgb(var(--fg))]">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`${textareaStyles} ${error ? "border-red-500" : ""} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

Textarea.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  rows: PropTypes.number,
  className: PropTypes.string,
};
