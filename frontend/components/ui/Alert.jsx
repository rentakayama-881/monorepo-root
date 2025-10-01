import React from "react";
import PropTypes from "prop-types";

/**
 * Alert UI:
 * - type: "error" | "success" | "info"
 * - message: string
 * - children: node (optional, custom isi)
 */
export default function Alert({ type = "info", message = "", children, className = "" }) {
  const base = "alert";
  const typeClass = {
    error: "alert-error",
    success: "alert-success",
    info: "",
  }[type] || "";
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
