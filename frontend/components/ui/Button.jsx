import React from "react";
import Link from "next/link";
import clsx from "clsx";

/**
 * Accessible button component with multiple variants
 * @param {Object} props
 * @param {"button"|"submit"|"reset"} props.type - Button type
 * @param {"primary"|"secondary"|"danger"|"outline"} props.variant - Visual variant
 * @param {boolean} props.loading - Show loading spinner
 * @param {boolean} props.disabled - Disable button
 * @param {string} props.href - If provided, renders as Link
 * @param {string} props.ariaLabel - Accessible label for icon-only buttons
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.className - Additional CSS classes
 */
export default function Button({
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  href,
  ariaLabel,
  children,
  className = "",
  ...rest
}) {
  // Base styles with focus-visible for accessibility
  const base = clsx(
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
    "transition-colors duration-200",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]",
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
  );
  
  const variants = {
    primary: "bg-[rgb(var(--brand))] text-white hover:opacity-90",
    secondary: "border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--muted))]",
    danger: "bg-[rgb(var(--error))] text-white hover:opacity-90",
    outline: "underline text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
  };

  const combinedClassName = clsx(base, variants[variant], className);

  // Accessibility: aria-busy for loading state
  const ariaProps = {
    "aria-label": ariaLabel,
    "aria-busy": loading || undefined,
    "aria-disabled": disabled || loading || undefined,
  };

  // If href is provided, render as Link
  if (href) {
    return (
      <Link 
        href={href} 
        className={combinedClassName} 
        aria-label={ariaLabel}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={combinedClassName}
      {...ariaProps}
      {...rest}
    >
      {loading && (
        <span 
          className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" 
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

