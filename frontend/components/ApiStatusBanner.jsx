"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchHealth } from "@/lib/api";

const RETRY_INTERVAL = 10; // seconds between auto-retry

export default function ApiStatusBanner() {
  const [healthy, setHealthy] = useState(true);
  const [checked, setChecked] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [countdown, setCountdown] = useState(RETRY_INTERVAL);

  const ping = useCallback(async () => {
    setRetrying(true);
    try {
      await fetchHealth();
      setHealthy(true);
      setChecked(true);
    } catch (err) {
      setHealthy(false);
      setChecked(true);
      setCountdown(RETRY_INTERVAL);
    } finally {
      setRetrying(false);
    }
  }, []);

  // Initial check
  useEffect(() => {
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      ping();
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(start, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [ping]);

  // Countdown timer when unhealthy
  useEffect(() => {
    if (healthy || !checked) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          ping();
          return RETRY_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [healthy, checked, ping]);

  if (healthy) return null;
  if (!checked) return null;

  return (
    <div className="fixed top-[var(--header-height)] left-0 right-0 z-40 w-full bg-warning text-warning-foreground shadow-md">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-center gap-3 text-sm font-medium">
        {/* Animated spinner */}
        <svg
          className={`w-4 h-4 ${retrying ? "animate-spin" : "animate-pulse"}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>

        <span>
          {retrying ? (
            "Menghubungkan ke server..."
          ) : (
            <>
              Koneksi terputus. Mencoba ulang dalam{" "}
              <span className="font-bold tabular-nums">{countdown}</span> detik
            </>
          )}
        </span>

        {/* Manual retry button */}
        {!retrying && (
          <button
            onClick={ping}
            className="ml-2 px-3 py-1 bg-warning-foreground/90 hover:bg-warning-foreground text-warning text-xs font-medium rounded-md transition-colors"
          >
            Coba Sekarang
          </button>
        )}
      </div>
    </div>
  );
}
