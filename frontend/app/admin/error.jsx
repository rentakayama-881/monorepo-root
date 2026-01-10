"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";

const isDev = process.env.NODE_ENV === "development";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    // Only log error details in development to prevent information leakage
    if (isDev) {
      console.error("Admin Error:", error);
    }
    // In production, errors should be sent to error tracking service (e.g., Sentry)
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="mx-auto w-16 h-16 rounded-full bg-[rgb(var(--error-bg))] flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-[rgb(var(--error))]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-[rgb(var(--fg))] mb-2">
          Error di Admin Panel
        </h2>

        <p className="text-[rgb(var(--muted))] mb-4">
          Terjadi kesalahan saat memuat halaman admin.
        </p>

        {/* Show error details only in development - hide internal details in production */}
        {isDev ? (
          <div className="mb-6 p-4 rounded-lg bg-[rgb(var(--surface-2))] text-left overflow-auto max-h-40">
            <p className="text-sm font-mono text-[rgb(var(--error))] break-all">
              {error?.message || "Unknown error"}
            </p>
            {error?.digest && (
              <p className="text-xs text-[rgb(var(--muted))] mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-lg bg-[rgb(var(--surface-2))] text-left">
            <p className="text-sm text-[rgb(var(--muted))]">
              Silakan coba lagi atau hubungi administrator jika masalah berlanjut.
            </p>
            {error?.digest && (
              <p className="text-xs text-[rgb(var(--muted))] mt-2">
                Reference: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="primary">
            Coba Lagi
          </Button>
          <Button href="/admin/login" variant="secondary">
            Login Ulang
          </Button>
        </div>
      </div>
    </div>
  );
}
