"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Button variants using class-variance-authority (prompts.chat style)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 gap-1.5 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Button component with multiple variants and sizes
 * @param {Object} props
 * @param {"default"|"destructive"|"outline"|"secondary"|"ghost"|"link"} props.variant
 * @param {"default"|"sm"|"lg"|"icon"|"icon-sm"|"icon-lg"} props.size
 * @param {boolean} props.loading - Show loading spinner
 * @param {boolean} props.disabled - Disable button
 * @param {string} props.href - If provided, renders as Link
 * @param {string} props.className - Additional CSS classes
 */
export default function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  href,
  className = "",
  children,
  type = "button",
  ...props
}) {
  const isDisabled = disabled || loading;

  // If href is provided, render as Link
  if (href) {
    return (
      <Link
        href={href}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && (
          <span 
            className="mr-1 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" 
            aria-hidden="true"
          />
        )}
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && (
        <span 
          className="mr-1 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" 
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export { buttonVariants };

