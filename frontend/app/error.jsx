"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import logger from "@/lib/logger";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error using production-safe logger
    logger.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Error icon */}
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
          Terjadi Kesalahan
        </h2>

        <p className="text-[rgb(var(--muted))] mb-6">
          Maaf, terjadi kesalahan saat memuat halaman ini. Silakan coba lagi
          atau kembali ke halaman utama.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="primary">
            Coba Lagi
          </Button>
          <Button href="/" variant="secondary">
            Ke Halaman Utama
          </Button>
        </div>

        {/* Error details (development only) */}
        {process.env.NODE_ENV === "development" && error?.message && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-[rgb(var(--muted))] cursor-pointer hover:text-[rgb(var(--fg))]">
              Detail Error (Development)
            </summary>
            <pre className="mt-2 p-3 bg-[rgb(var(--surface-2))] rounded-md text-xs overflow-auto text-[rgb(var(--error))]">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
