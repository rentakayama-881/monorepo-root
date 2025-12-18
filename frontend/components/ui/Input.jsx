import React from "react";
import PropTypes from "prop-types";

/**
 * Input generik:
 * - type: "text" | "email" | "password" | "number" | "file" | etc.
 * - label: string (optional, tampil di atas input)
 * - error: string (optional, tampil di bawah input)
 * - ...rest: props lain (value, onChange, placeholder, aria-label, dsb)
 */
export default function Input({
  type = "text",
  label = "",
  error = "",
  className = "",
  ...rest
}) {
  const inputStyles =
    "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900";
  return (
    <div className="mb-3">
      {label && (
        <label className="mb-1 block text-sm font-medium text-neutral-900">{label}</label>
      )}
      <input
        type={type}
        className={`${inputStyles} ${error ? "border-red-500" : ""} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error && (
        <div className="mt-1 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}

Input.propTypes = {
  type: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  className: PropTypes.string,
};
