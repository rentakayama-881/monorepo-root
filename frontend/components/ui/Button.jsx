"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
        // Alias: some pages still use `primary`
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
        // Alias: some pages still use `danger`
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
        outline: "border bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-glow-subtle hover:scale-[1.02] active:scale-[0.98]",
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

export default function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  href,
  className = "",
  children,
  iconLeft,
  iconRight,
  type = "button",
  ...props
}) {
  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading && (
        <span 
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" 
          aria-hidden="true"
          aria-label="Loading"
        />
      )}
      {!loading && iconLeft && <span className="inline-flex shrink-0">{iconLeft}</span>}
      {children}
      {!loading && iconRight && <span className="inline-flex shrink-0">{iconRight}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(buttonVariants({ variant, size }), isDisabled && "opacity-50 pointer-events-none", className)}
        {...props}
      >
        {content}
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
      {content}
    </button>
  );
}

export { buttonVariants };
