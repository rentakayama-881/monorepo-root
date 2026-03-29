"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

// Note: Cannot use logger here as this is a root error boundary
// and may not have access to all modules
const isDev = process.env.NODE_ENV === "development";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    if (isDev) {
      console.error("Global application error:", error);
      return;
    }

    // Capture root boundary errors to improve production incident visibility.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            {/* Critical error icon with animation */}
            <div className="mx-auto w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 rounded-full bg-destructive/10 animate-ping" />
              <svg
                className="w-12 h-12 text-destructive relative z-10"
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

            <h1 className="text-3xl font-bold text-foreground mb-3">
              Terjadi Kesalahan Aplikasi Kritis
            </h1>

            <p className="text-muted-foreground mb-8">
              Aplikasi mengalami kendala yang tidak terduga. Silakan muat ulang halaman atau coba
              lagi beberapa saat lagi.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all hover:scale-105"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Muat Ulang
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-lg transition-all hover:scale-105"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Ke Beranda
              </Link>
            </div>

            {/* Support contact */}
            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Jika masalah terus berlanjut, silakan hubungi tim dukungan kami.
              </p>
              <Link
                href="/contact-support"
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Hubungi Dukungan
              </Link>
            </div>

            {/* Error details for debugging */}
            {process.env.NODE_ENV === "development" && error?.message && (
              <details className="mt-8 text-left">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto text-destructive max-h-48">
                  {error.message}
                  {error.digest && `\n\nDigest: ${error.digest}`}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
