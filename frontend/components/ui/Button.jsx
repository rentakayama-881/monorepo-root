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
    primary: "bg-[rgb(var(--brand))] text-white hover:opacity-90",
    secondary: "border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--muted))]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "underline text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
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
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--border))] border-t-current" />
      )}
      {children}
    </button>
  );
}

