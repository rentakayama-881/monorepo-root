"use client";

import { useEffect, useState } from "react";

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex flex-col gap-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Kami memakai cookie esensial untuk menjaga sesi login tetap stabil. Cookie analitik bersifat opsional.
        </p>
        <div className="flex items-center gap-2">
          {confirmReject ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmReject(false)}
                className="rounded border border-border px-2 py-1 text-foreground hover:bg-accent"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={reject}
                className="rounded border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
              >
                Tolak Analitik
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={reject}
                className="rounded border border-border px-2 py-1 text-foreground hover:bg-accent"
              >
                Tolak
              </button>
              <button
                type="button"
                onClick={accept}
                className="rounded border border-primary bg-primary px-2 py-1 font-medium text-primary-foreground hover:opacity-90"
              >
                Terima
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
