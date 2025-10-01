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
    "btn transition-fast font-medium";
  const variantClass = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-200",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  }[variant] || variantClass.primary;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variantClass} ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="spinner mr-2 align-middle" aria-label="Loading" />
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
