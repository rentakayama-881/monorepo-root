import { cn } from "@/lib/utils";

export const AUTH_INPUT_CLASS =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export const AUTH_PRIMARY_BUTTON_CLASS =
  "w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const AUTH_SECONDARY_BUTTON_CLASS =
  "w-full inline-flex justify-center items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-60";

const noticeVariants = {
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  error: "border-destructive/20 bg-destructive/10 text-destructive",
};

export function AuthContainer({ children, className = "" }) {
  return <div className={cn("mx-auto w-full max-w-sm space-y-4", className)}>{children}</div>;
}

export function AuthHeader({ title, description }) {
  return (
    <div className="text-center space-y-1">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function AuthCard({ children, className = "" }) {
  return <div className={cn("rounded-lg border border-border bg-card p-4 shadow-soft", className)}>{children}</div>;
}

export function AuthField({ label, htmlFor, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function AuthNotice({ variant = "warning", children, className = "" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        noticeVariants[variant] || noticeVariants.warning,
        className
      )}
    >
      {children}
    </div>
  );
}
