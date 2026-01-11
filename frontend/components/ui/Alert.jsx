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
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    success: "border-emerald-600/30 bg-emerald-600/10 text-emerald-600",
    warning: "border-amber-600/30 bg-amber-600/10 text-amber-600",
    info: "border-border bg-muted/50 text-foreground",
  }[type] || "border-border bg-muted/50 text-foreground";
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
