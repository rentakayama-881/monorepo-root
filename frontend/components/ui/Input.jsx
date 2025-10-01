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
  return (
    <div className="mb-3">
      {label && (
        <label className="block text-sm font-medium mb-1">{label}</label>
      )}
      <input
        type={type}
        className={`input ${error ? "border-red-600" : ""} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error && (
        <div className="text-xs text-red-600 mt-1">{error}</div>
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
