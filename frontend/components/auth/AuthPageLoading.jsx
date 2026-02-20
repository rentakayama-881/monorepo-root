import { cn } from "@/lib/utils";

export default function AuthPageLoading({ message = "Loading...", fullPage = true, className = "" }) {
  return (
    <div className={cn(fullPage && "min-h-screen bg-background", className)}>
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
