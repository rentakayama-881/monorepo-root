/**
 * Loading state for /admin/login
 */
export default function AdminLoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="rounded-[var(--radius)] border border-border bg-card p-8 animate-pulse">
          {/* Title skeleton */}
          <div className="h-7 w-32 bg-border rounded mx-auto mb-6"></div>

          {/* Form fields skeleton */}
          <div className="space-y-4">
            <div>
              <div className="h-4 w-16 bg-border rounded mb-2"></div>
              <div className="h-10 bg-border rounded"></div>
            </div>
            <div>
              <div className="h-4 w-20 bg-border rounded mb-2"></div>
              <div className="h-10 bg-border rounded"></div>
            </div>
            <div className="h-10 bg-border rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
