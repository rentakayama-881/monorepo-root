import React, { memo } from "react";

/**
 * Spinner UI generik, gunakan untuk loading state.
 */
const Spinner = memo(function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground ${className}`}
      aria-label="Memuat"
    />
  );
});

export default Spinner;
