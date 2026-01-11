/**
 * Global loading component for route transitions
 * Enhanced with skeleton screens and branded loading experience
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 max-w-md w-full">
        {/* Logo with pulse animation */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <svg className="h-8 w-8 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        {/* Animated progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-primary/60 animate-pulse" 
                 style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          </div>
        </div>
        
        {/* Loading text with subtle animation */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            Memuat halaman...
          </p>
          <p className="text-xs text-muted-foreground animate-pulse">
            Mohon tunggu sebentar
          </p>
        </div>

        {/* Skeleton preview */}
        <div className="w-full space-y-3 mt-4">
          <div className="h-4 bg-secondary rounded animate-pulse" />
          <div className="h-4 bg-secondary rounded animate-pulse w-5/6" />
          <div className="h-4 bg-secondary rounded animate-pulse w-4/6" />
        </div>
      </div>
    </div>
  );
}
