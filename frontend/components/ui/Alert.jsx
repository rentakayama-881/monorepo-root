"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Enhanced Alert component with variants and features:
 * - variant: "info" | "success" | "warning" | "error" (default "info")
 * - title: string (optional, bold title)
 * - message: string (alert message)
 * - children: node (optional, custom content)
 * - dismissible: boolean (show close button)
 * - onDismiss: function (called when dismissed)
 * - action: { label: string, onClick: function } (action button)
 * - compact: boolean (smaller padding for inline alerts)
 * - icon: boolean (show/hide icon, default true)
 * - className: string (additional classes)
 */
export default function Alert({
  variant = "info",
  title = "",
  message = "",
  children,
  dismissible = false,
  onDismiss,
  action,
  compact = false,
  icon: showIcon = true,
  className = "",
}) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const variantStyles = {
    info: {
      container: "border-border bg-muted/50 text-foreground",
      icon: "text-primary",
      iconPath:
        "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    success: {
      container: "border-success/30 bg-success/10 text-success dark:text-success",
      icon: "text-success",
      iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    warning: {
      container: "border-warning/30 bg-warning/10 text-warning dark:text-warning",
      icon: "text-warning",
      iconPath:
        "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    },
    error: {
      container: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: "text-destructive",
      iconPath:
        "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };

  const styles = variantStyles[variant] || variantStyles.info;

  return (
    <div
      className={clsx(
        "rounded-md border transition-all duration-200 animate-fade-in",
        compact ? "px-2 py-1.5" : "px-3 py-2",
        styles.container,
        className
      )}
      role="alert"
      tabIndex={-1}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        {showIcon && (
          <svg
            className={clsx(
              "flex-shrink-0 mt-0.5",
              compact ? "w-4 h-4" : "w-5 h-5",
              styles.icon
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={styles.iconPath}
            />
          </svg>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <div className={clsx("font-semibold", compact ? "text-xs" : "text-sm")}>
              {title}
            </div>
          )}
          {message && (
            <div
              className={clsx(
                compact ? "text-xs" : "text-sm",
                title && "mt-0.5 opacity-90"
              )}
            >
              {message}
            </div>
          )}
          {children && <div className={compact ? "text-xs" : "text-sm"}>{children}</div>}

          {/* Action Button */}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={clsx(
                "mt-2 font-medium underline-offset-2 hover:underline transition-colors",
                compact ? "text-xs" : "text-sm"
              )}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss alert"
          >
            <svg
              className={compact ? "w-3.5 h-3.5" : "w-4 h-4"}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

Alert.propTypes = {
  variant: PropTypes.oneOf(["info", "success", "warning", "error"]),
  title: PropTypes.string,
  message: PropTypes.string,
  children: PropTypes.node,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
  action: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
  }),
  compact: PropTypes.bool,
  icon: PropTypes.bool,
  className: PropTypes.string,
};
