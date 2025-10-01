import React from "react";

/**
 * Spinner UI generik, gunakan untuk loading state.
 */
export default function Spinner({ className = "" }) {
  return (
    <span className={`spinner ${className}`} aria-label="Loading" />
  );
}
