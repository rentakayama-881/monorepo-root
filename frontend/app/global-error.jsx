"use client";

import { useEffect } from "react";

// Note: Cannot use logger here as this is a root error boundary
// and may not have access to all modules
const isDev = process.env.NODE_ENV === "development";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    if (isDev) {
      console.error("Global application error:", error);
    }
    // TODO: Send to error tracking service in production
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-dvh bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            {/* Critical error icon with animation */}
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-800/20 flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 rounded-full bg-red-500/10 animate-ping" />
              <svg
                className="w-12 h-12 text-red-600 dark:text-red-400 relative z-10"
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

            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              Terjadi Kesalahan Kritis
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Aplikasi mengalami masalah yang tidak terduga. Silakan muat ulang
              halaman atau coba lagi nanti.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Muat Ulang
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-medium rounded-lg transition-all hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Ke Halaman Utama
              </a>
            </div>

            {/* Support contact */}
            <div className="pt-6 border-t border-gray-300 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Jika masalah berlanjut, hubungi tim support kami
              </p>
              <a
                href="/contact-support"
                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Hubungi Support
              </a>
            </div>

            {/* Error details for debugging */}
            {process.env.NODE_ENV === "development" && error?.message && (
              <details className="mt-8 text-left">
                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  Detail Error (Development Only)
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-xs overflow-auto text-red-600 dark:text-red-400 max-h-48">
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
