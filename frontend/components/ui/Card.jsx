import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

/**
 * Card variants - prompts.chat style
 */
const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col rounded-[var(--radius)] border transition-all duration-200",
  {
    variants: {
      variant: {
        default: "",
        interactive: "cursor-pointer hover:shadow-soft hover:-translate-y-0.5 hover:border-foreground/20",
        gradient: "gradient-border hover:shadow-glow-subtle",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Card component (prompts.chat style)
 */
function Card({ className, children, variant = "default", onClick, ...props }) {
  return (
    <div
      className={cn(cardVariants({ variant }), className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader component - prompts.chat compact padding
 */
function CardHeader({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "px-4 py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardTitle component
 */
function CardTitle({ className, children, ...props }) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * CardDescription component
 */
function CardDescription({ className, children, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * CardContent component - prompts.chat efficient spacing
 */
function CardContent({ className, children, ...props }) {
  return (
    <div className={cn("px-4 py-2", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * CardFooter component - prompts.chat style with border-t
 */
function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn("flex items-center px-4 py-3 border-t", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
