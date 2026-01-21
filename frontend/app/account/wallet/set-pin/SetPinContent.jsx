"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getValidToken } from "@/lib/tokenRefresh";
import logger from "@/lib/logger";

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
  const [hasPin, setHasPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");

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
        setHasPin(pinStatus.pinSet || false);
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
      setError("PIN harus 6 digit");
      return;
    }

    if (pin !== confirmPin) {
      setError("PIN tidak cocok");
      return;
    }

    // Check for weak PINs
    const weakPins = ["123456", "654321", "111111", "000000", "123123"];
    if (weakPins.includes(pin)) {
      setError("PIN terlalu mudah ditebak. Gunakan kombinasi yang lebih aman.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Get fresh token before API call to prevent token expiry issues
      const freshToken = await getValidToken();
      if (!freshToken) {
        setError("Sesi telah berakhir. Silakan login kembali.");
        router.push("/login");
        return;
      }

      // Determine endpoint and body based on whether user is changing or setting PIN
      const endpoint = hasPin
        ? FEATURE_ENDPOINTS.WALLETS.CHANGE_PIN
        : FEATURE_ENDPOINTS.WALLETS.SET_PIN;

      const body = hasPin
        ? { currentPin: currentPin, newPin: pin, confirmNewPin: confirmPin }
        : { pin: pin, confirmPin: confirmPin };

      await fetchFeatureAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Success - redirect based on context
      if (redirect === "withdraw") {
        router.push("/account/wallet/withdraw");
      } else if (redirect === "send") {
        router.push("/account/wallet/send");
      } else {
        router.push("/account/wallet/transactions?success=pin");
      }
    } catch (e) {
      logger.error("Failed to set PIN:", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push("/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/set-pin"));
        return;
      }
      setError(e.message || "Gagal menyimpan PIN");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="animate-pulse">
            <div className="h-16 w-16 rounded-full bg-border mx-auto mb-4" />
            <div className="h-8 w-48 bg-border rounded mx-auto mb-2" />
            <div className="h-4 w-64 bg-border rounded mx-auto mb-8" />
            <div className="h-64 bg-border rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-md px-4 py-8">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 text-primary]"
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
            {hasPin ? "Ubah PIN" : "Buat PIN Transaksi"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            PIN digunakan untuk mengamankan transaksi keuangan Anda
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6">
          {/* Step indicators */}
          <div className="mb-6 flex justify-center gap-2">
            {(hasPin ? [1, 2, 3] : [1, 2]).map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition ${
                  step >= s ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>

          {/* Step: Current PIN (only if changing) */}
          {hasPin && step === 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">
                Masukkan PIN Saat Ini
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={(e) => handlePinChange(e.target.value, setCurrentPin)}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={() => setStep(2)}
                disabled={currentPin.length !== 6}
                className="mt-6 w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Lanjutkan
              </button>
            </div>
          )}

          {/* Step: New PIN */}
          {((hasPin && step === 2) || (!hasPin && step === 1)) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">
                {hasPin ? "Masukkan PIN Baru" : "Buat PIN 6 Digit"}
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
                Hindari PIN yang mudah ditebak seperti 123456
              </p>
              <div className="mt-6 flex gap-3">
                {hasPin && (
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 rounded-lg border border-border py-3 font-medium"
                  >
                    Kembali
                  </button>
                )}
                <button
                  onClick={() => setStep(hasPin ? 3 : 2)}
                  disabled={pin.length !== 6}
                  className={`${hasPin ? "flex-1" : "w-full"} rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50`}
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          )}

          {/* Step: Confirm PIN */}
          {((hasPin && step === 3) || (!hasPin && step === 2)) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 text-center">
                Konfirmasi PIN
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
                <p className="mt-2 text-sm text-destructive text-center">PIN tidak cocok</p>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep(hasPin ? 2 : 1)}
                  className="flex-1 rounded-lg border border-border py-3 font-medium"
                >
                  Kembali
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing || confirmPin.length !== 6 || confirmPin !== pin}
                  className="flex-1 rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Menyimpan..." : "Simpan PIN"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Critical warning - PIN cannot be reset */}
        {!hasPin && (
          <div className="mt-6 rounded-lg bg-destructive/10 border border-destructive/30 p-4">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm">
                <p className="font-semibold text-destructive mb-1">⚠️ Peringatan Penting</p>
                <p className="text-muted-foreground">
                  <strong>PIN tidak dapat di-reset atau dipulihkan.</strong> Jika Anda lupa PIN,
                  Anda tidak akan bisa melakukan transaksi dan harus menghubungi admin untuk bantuan.
                  Pastikan Anda mengingat PIN yang Anda buat.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Security notice */}
        <div className="mt-6 rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-blue-600 mb-1">Tips Keamanan</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Jangan bagikan PIN Anda kepada siapapun</li>
                <li>Gunakan kombinasi angka yang unik</li>
                <li>Hindari menggunakan tanggal lahir</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
