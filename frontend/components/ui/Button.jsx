import React from "react";
import Link from "next/link"; // Kita butuh ini buat navigasi
import clsx from "clsx";

export default function Button({
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  href, // Tambahan properti href
  children,
  className = "",
  ...rest
}) {
  // Style dasar (sama seperti sebelumnya, tapi pakai clsx biar rapi)
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200",
    secondary: "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-black dark:text-white dark:hover:bg-neutral-900",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "underline hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200"
  };

  const combinedClassName = clsx(base, variants[variant], className);

  // LOGIKA BARU: Kalau ada href, jadi Link. Kalau tidak, jadi Button biasa.
  if (href) {
    return (
      <Link href={href} className={combinedClassName} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={combinedClassName}
      {...rest}
    >
      {loading && (
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-current" />
      )}
      {children}
    </button>
  );
}

