"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
} from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getValidToken } from "@/lib/tokenRefresh";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";

function normalizePinStatus(payload) {
  const data = unwrapFeatureData(payload) || {};
  const pinSetRaw =
    data.pinSet ?? data.PinSet ?? data.pin_set ?? data.hasPin ?? data.has_pin ?? false;
  return Boolean(pinSetRaw);
}

export default function SetPinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [step, setStep] = useState(1);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkWalletAndTwoFactor() {
      // Use getValidToken to ensure we have a fresh token
      const token = await getValidToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        // First check if 2FA is enabled (required for PIN)
        const totpRes = await fetchJsonAuth("/api/auth/totp/status");
        if (!totpRes.enabled) {
          // Redirect to 2FA setup with return URL
          router.push("/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/set-pin" + (redirect ? "?redirect=" + redirect : "")));
          return;
        }

        // Get PIN status from Feature Service
        const pinStatus = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.PIN_STATUS);
        const pinAlreadySet = normalizePinStatus(pinStatus);

        // PIN can only be set once — if already set, redirect to transactions
        if (pinAlreadySet) {
          router.push("/account/wallet/transactions");
          return;
        }
      } catch (e) {
        logger.error("Failed to check wallet:", e);
        // If Feature Service unavailable, show error
        if (e.status === 403 && e.code === "TWO_FACTOR_REQUIRED") {
          router.push("/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/set-pin"));
          return;
        }
      }
      setLoading(false);
    }

    checkWalletAndTwoFactor();
  }, [router, redirect]);

  const handlePinChange = (value, setter) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setter(cleaned);
  };

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      setError("PIN must be 6 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    // Check for weak PINs
    const weakPins = ["123456", "654321", "111111", "000000", "123123"];
    if (weakPins.includes(pin)) {
      setError("This PIN is too predictable. Please choose a stronger combination.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Get fresh token before API call to prevent token expiry issues
      const freshToken = await getValidToken();
      if (!freshToken) {
        setError("Your session has expired. Please sign in again.");
        router.push("/login");
        return;
      }

      await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.PIN_SET, {
        method: "POST",
        body: JSON.stringify({ pin: pin, confirmPin: confirmPin }),
      });

      // Success - redirect based on context
      if (redirect === "withdraw") {
        router.push("/account/wallet/withdraw");
      } else if (redirect === "send") {
        router.push("/account/wallet/send");
      } else if (redirect === "deposit") {
        router.push("/account/wallet/deposit");
      } else if (redirect === "passkey") {
        router.push("/account?focus=passkeys");
      } else {
        router.push("/account/wallet/transactions?success=pin");
      }
    } catch (e) {
      logger.error("Failed to set PIN:", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push("/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/set-pin"));
        return;
      }
      setError(getErrorMessage(e, "Unable to save PIN."));
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="animate-pulse">
            <div className="h-16 w-16 rounded-full bg-border mx-auto mb-4" />
            <div className="h-8 w-48 bg-border rounded mx-auto mb-2" />
            <div className="h-4 w-64 bg-border rounded mx-auto mb-8" />
            <div className="h-64 bg-border rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-8">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Create Transaction PIN
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            This PIN protects your financial transactions
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6">
          {/* Step indicators — always 2 steps */}
          <div className="mb-6 flex justify-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition ${
                  step >= s ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>

          {/* Step 1: New PIN */}
          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">
                Create 6-Digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-primary"
                autoFocus
              />
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Avoid predictable PINs such as 123456
              </p>
              <button
                onClick={() => setStep(2)}
                disabled={pin.length !== 6}
                className="mt-6 w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Lanjutkan
              </button>
            </div>
          )}

          {/* Step 2: Confirm PIN */}
          {step === 2 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">
                Confirm PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-primary"
                autoFocus
              />
              {confirmPin.length === 6 && confirmPin !== pin && (
                <p className="mt-2 text-sm text-destructive text-center">PINs do not match</p>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-border py-3 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing || confirmPin.length !== 6 || confirmPin !== pin}
                  className="flex-1 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Saving..." : "Save PIN"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Critical warning - PIN cannot be reset */}
        <div className="mt-6 rounded-lg bg-destructive/10 border border-destructive/30 p-4">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-destructive mb-1">Important Notice</p>
              <p className="text-muted-foreground">
                <strong>PIN cannot be reset or recovered.</strong> If you forget your PIN,
                you will not be able to perform transactions and will need to contact support for assistance.
                Make sure you remember the PIN you set.
              </p>
            </div>
          </div>
        </div>

        {/* Security notice */}
        <div className="mt-6 rounded-lg bg-primary/10 border border-primary/30 p-4">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-primary mb-1">Security Tips</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Never share your PIN with anyone</li>
                <li>Gunakan kombinasi angka yang unik</li>
                <li>Avoid using your birth date</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
