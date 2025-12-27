import React from "react";
import PropTypes from "prop-types";

/**
 * Alert UI:
 * - type: "error" | "success" | "info"
 * - message: string
 * - children: node (optional, custom isi)
 */
export default function Alert({ type = "info", message = "", children, className = "" }) {
  const base = "rounded-md border px-3 py-2 text-sm";
  const typeClass = {
    error: "border-[rgb(var(--error-border))] bg-[rgb(var(--error-bg))] text-[rgb(var(--error))]",
    success: "border-[rgb(var(--success-border))] bg-[rgb(var(--success-bg))] text-[rgb(var(--success))]",
    warning: "border-[rgb(var(--warning-border))] bg-[rgb(var(--warning-bg))] text-[rgb(var(--warning))]",
    info: "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]",
  }[type] || "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]";
  return (
    <div className={`${base} ${typeClass} ${className}`} role="alert" tabIndex={-1}>
      {message}
      {children}
    </div>
  );
}

Alert.propTypes = {
  type: PropTypes.oneOf(["error", "success", "info"]),
  message: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};
