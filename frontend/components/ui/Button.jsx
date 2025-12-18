import React from "react";
import PropTypes from "prop-types";

/**
 * Button UI generik, props-driven.
 * - type: "button" | "submit" | "reset"
 * - variant: "primary" | "secondary" | "danger"
 * - loading: boolean, jika true tampil spinner
 * - disabled: boolean, otomatis disable style & pointer
 * - children: isi button
 * - ...rest: props lain (onClick, aria-label, dsb)
 */
export default function Button({
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  children,
  className = "",
  ...rest
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const variantClass = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:outline-neutral-900",
    secondary: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus-visible:outline-neutral-900",
    danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-700",
  }[variant] || "bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:outline-neutral-900";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variantClass} ${disabled || loading ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-current align-middle"
          aria-label="Loading"
        />
      )}
      {children}
    </button>
  );
}

Button.propTypes = {
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  variant: PropTypes.oneOf(["primary", "secondary", "danger"]),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
};
