"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getValidToken } from "@/lib/tokenRefresh";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";
import { ChevronLeft, Lock, AlertTriangle, ShieldCheck } from "lucide-react";

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
          router.push(
            "/account/security?setup2fa=true&redirect=" +
              encodeURIComponent(
                "/account/wallet/set-pin" + (redirect ? "?redirect=" + redirect : "")
              )
          );
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
          router.push(
            "/account/security?setup2fa=true&redirect=" +
              encodeURIComponent("/account/wallet/set-pin")
          );
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
      setError("PIN harus terdiri dari 6 digit.");
      return;
    }

    if (pin !== confirmPin) {
      setError("PIN tidak cocok.");
      return;
    }

    // Check for weak PINs
    const weakPins = ["123456", "654321", "111111", "000000", "123123"];
    if (weakPins.includes(pin)) {
      setError("PIN ini terlalu mudah ditebak. Gunakan kombinasi yang lebih kuat.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Get fresh token before API call to prevent token expiry issues
      const freshToken = await getValidToken();
      if (!freshToken) {
        setError("Sesi Anda telah berakhir. Silakan masuk kembali.");
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
        router.push(
          "/account/security?setup2fa=true&redirect=" +
            encodeURIComponent("/account/wallet/set-pin")
        );
        return;
      }
      setError(getErrorMessage(e, "Gagal menyimpan PIN."));
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 sm:px-6 py-8">
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
      <div className="mx-auto max-w-md px-4 sm:px-6 py-8">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat PIN Transaksi</h1>
          <p className="text-sm text-muted-foreground mt-1">
            PIN ini melindungi transaksi finansial Anda
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
                Buat PIN 6 Digit
              </label>
              <input
                type="password"
                data-testid="setpin-pin-input"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-primary"
                autoFocus
              />
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Hindari PIN yang mudah ditebak seperti 123456
              </p>
              <button
                data-testid="setpin-continue-button"
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
                Konfirmasi PIN
              </label>
              <input
                type="password"
                data-testid="setpin-confirm-input"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-primary"
                autoFocus
              />
              {confirmPin.length === 6 && confirmPin !== pin && (
                <p className="mt-2 text-sm text-destructive text-center">PIN tidak cocok</p>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-border py-3 font-medium"
                >
                  Kembali
                </button>
                <button
                  data-testid="setpin-save-button"
                  onClick={handleSubmit}
                  disabled={processing || confirmPin.length !== 6 || confirmPin !== pin}
                  className="flex-1 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Menyimpan..." : "Simpan PIN"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Critical warning - PIN cannot be reset */}
        <div className="mt-6 rounded-lg bg-destructive/10 border border-destructive/30 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive mb-1">Perhatian Penting</p>
              <p className="text-muted-foreground">
                <strong>PIN tidak bisa direset atau dipulihkan.</strong> Jika Anda lupa PIN, Anda
                tidak akan bisa melakukan transaksi dan perlu menghubungi dukungan untuk bantuan.
                Pastikan Anda mengingat PIN yang Anda buat.
              </p>
            </div>
          </div>
        </div>

        {/* Security notice */}
        <div className="mt-6 rounded-lg bg-primary/10 border border-primary/30 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-primary mb-1">Tips Keamanan</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Jangan pernah membagikan PIN Anda kepada siapa pun</li>
                <li>Gunakan kombinasi angka yang unik</li>
                <li>Hindari menggunakan tanggal lahir</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
