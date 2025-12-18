import React from "react";

/**
 * Spinner UI generik, gunakan untuk loading state.
 */
export default function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 ${className}`}
      aria-label="Loading"
    />
  );
}
