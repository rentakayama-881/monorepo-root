"use client";

import { useEffect, useState } from "react";
import Button from "./ui/Button";
import { CookieIcon } from "./ui/LegalIcons";

const COOKIE_CONSENT_KEY = "cookie-consent";

export function getCookieConsent() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
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
    ? "Tolak cookie analitik? Cookie esensial tetap aktif."
    : "Cookie esensial menjaga sesi login. Cookie analitik opsional.";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex items-center justify-between gap-4 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <CookieIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{message}</span>
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
