"use client";

import { useEffect, useState } from "react";
import Button from "./ui/Button";

const COOKIE_CONSENT_KEY = "cookie-consent";

export function getCookieConsent() {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

function CookieIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
      <path d="M8.5 8.5v.01" />
      <path d="M16 15.5v.01" />
      <path d="M12 12v.01" />
      <path d="M11 17v.01" />
      <path d="M7 14v.01" />
    </svg>
  );
}

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState("pending");
  const [confirmReject, setConfirmReject] = useState(false);

  useEffect(() => {
    setConsent(getCookieConsent());
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {}
    setConsent("accepted");
    window.location.reload();
  };

  const reject = () => {
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    } catch {}
    setConsent("rejected");
  };

  if (consent !== null) return null;

  const message = confirmReject
    ? "Tolak analitik? Cookie esensial tetap aktif."
    : "Cookie esensial untuk login. Analitik opsional.";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex items-center justify-between gap-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CookieIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{message}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirmReject ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirmReject(false)}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={reject}
              >
                Tolak Analitik
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={reject}
              >
                Tolak
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={accept}
              >
                Terima
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
