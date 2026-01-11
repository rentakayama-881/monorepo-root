"use client";

/**
 * SearchInput - Client component for search functionality
 * Used in not-found.jsx to avoid Server Component event handler error
 */
export default function SearchInput({ placeholder = "Search..." }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full rounded-[var(--radius)] border bg-card px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-all"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.value) {
            window.location.href = `/search?q=${encodeURIComponent(e.target.value)}`;
          }
        }}
      />
    </div>
  );
}
