/**
 * Global loading component for route transitions
 * Clean, minimal loading experience
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        {/* Simple spinner */}
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
        
        {/* Loading text */}
        <p className="text-sm text-muted-foreground">
          Loading...
        </p>
      </div>
    </div>
  );
}
