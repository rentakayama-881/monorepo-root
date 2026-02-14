"use client";

import { useEffect, useState } from "react";
import Button from "./ui/Button";

const COOKIE_CONSENT_KEY = "cookie-consent";

export function getCookieConsent() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
}

function CookieIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.5 3.4a1.8 1.8 0 0 0 3 1.9 1.8 1.8 0 0 1 2.3-.5 1.8 1.8 0 0 1 .8 2.2 1.8 1.8 0 0 0 2.1 2.5 1.8 1.8 0 0 1 2.1 1.3 1.8 1.8 0 0 1-1 2.2 1.8 1.8 0 0 0-1 2.5 1.8 1.8 0 0 1-.6 2.3 1.8 1.8 0 0 1-2.3-.2 1.8 1.8 0 0 0-2.8.6 1.8 1.8 0 0 1-2.1 1.3 1.8 1.8 0 0 1-1.3-2 1.8 1.8 0 0 0-2.6-1.8 1.8 1.8 0 0 1-2.2-.8 1.8 1.8 0 0 1 .5-2.3 1.8 1.8 0 0 0-.7-3.1 1.8 1.8 0 0 1-1.2-2.1 1.8 1.8 0 0 1 2-1.3 1.8 1.8 0 0 0 2.1-2.4 1.8 1.8 0 0 1 1-2.2 1.8 1.8 0 0 1 2.2.7z" />
      <circle cx="8.4" cy="9.1" r="1.1" />
      <circle cx="14.9" cy="11.2" r="1.1" />
      <circle cx="10.6" cy="15" r="1" />
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
    ? "Yakin menolak cookie analitik? Cookie esensial tetap aktif untuk menjaga sesi login."
    : "Kami memakai cookie esensial untuk sesi login. Cookie analitik bersifat opsional.";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex flex-col gap-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <CookieIcon className="h-3.5 w-3.5 shrink-0" />
          <p className="leading-relaxed">{message}</p>
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
