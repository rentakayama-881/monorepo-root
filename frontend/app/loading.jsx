/**
 * Global loading component for route transitions
 * This will be shown during navigation between pages
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-[rgb(var(--border))]"></div>
          <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-t-[rgb(var(--brand))] animate-spin"></div>
        </div>
        
        {/* Loading text */}
        <p className="text-sm text-[rgb(var(--muted))] animate-pulse">
          Memuat...
        </p>
      </div>
    </div>
  );
}
