import { cn } from "@/lib/utils";

/**
 * Card component (prompts.chat style)
 */
function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-[var(--radius)] border py-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader component
 */
function CardHeader({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6",
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
 * CardContent component
 */
function CardContent({ className, children, ...props }) {
  return (
    <div className={cn("px-6", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * CardFooter component
 */
function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
