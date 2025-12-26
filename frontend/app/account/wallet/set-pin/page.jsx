"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Header from "@/components/Header";

export default function SetPinPage() {
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
    async function checkWallet() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch(`${getApiBase()}/api/wallet/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHasPin(data.has_pin);
        }
      } catch (e) {
        console.error("Failed to check wallet:", e);
      }
      setLoading(false);
    }

    checkWallet();
  }, [router]);

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

    const token = getToken();
    setProcessing(true);
    setError("");

    try {
      const body = { new_pin: pin };
      if (hasPin) {
        body.old_pin = currentPin;
      }

      const res = await fetch(`${getApiBase()}/api/wallet/pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        // Redirect based on context
        if (redirect === "withdraw") {
          router.push("/account/wallet/withdraw");
        } else if (redirect === "send") {
          router.push("/account/wallet/send");
        } else {
          router.push("/account/wallet/transactions?success=pin");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan PIN");
      }
    } catch (e) {
      setError("Terjadi kesalahan");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
          <div className="mx-auto max-w-md px-4 py-8 text-center text-[rgb(var(--muted))]">
            Memuat...
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
        <div className="mx-auto max-w-md px-4 py-8">
          <Link
            href="/account"
            className="mb-6 inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </Link>

          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <svg
                className="h-8 w-8 text-emerald-600"
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
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">
              {hasPin ? "Ubah PIN" : "Buat PIN Transaksi"}
            </h1>
            <p className="text-sm text-[rgb(var(--muted))] mt-1">
              PIN digunakan untuk mengamankan transaksi keuangan Anda
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
            {/* Step indicators */}
            <div className="mb-6 flex justify-center gap-2">
              {(hasPin ? [1, 2, 3] : [1, 2]).map((s) => (
                <div
                  key={s}
                  className={`h-2 w-8 rounded-full transition ${
                    step >= s ? "bg-emerald-600" : "bg-[rgb(var(--border))]"
                  }`}
                />
              ))}
            </div>

            {/* Step: Current PIN (only if changing) */}
            {hasPin && step === 1 && (
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2 text-center">
                  Masukkan PIN Saat Ini
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => handlePinChange(e.target.value, setCurrentPin)}
                  placeholder="••••••"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  onClick={() => setStep(2)}
                  disabled={currentPin.length !== 6}
                  className="mt-6 w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  Lanjutkan
                </button>
              </div>
            )}

            {/* Step: New PIN */}
            {((hasPin && step === 2) || (!hasPin && step === 1)) && (
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2 text-center">
                  {hasPin ? "Masukkan PIN Baru" : "Buat PIN 6 Digit"}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value, setPin)}
                  placeholder="••••••"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <p className="mt-2 text-xs text-[rgb(var(--muted))] text-center">
                  Hindari PIN yang mudah ditebak seperti 123456
                </p>
                <div className="mt-6 flex gap-3">
                  {hasPin && (
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 rounded-lg border border-[rgb(var(--border))] py-3 font-medium"
                    >
                      Kembali
                    </button>
                  )}
                  <button
                    onClick={() => setStep(hasPin ? 3 : 2)}
                    disabled={pin.length !== 6}
                    className={`${hasPin ? "flex-1" : "w-full"} rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50`}
                  >
                    Lanjutkan
                  </button>
                </div>
              </div>
            )}

            {/* Step: Confirm PIN */}
            {((hasPin && step === 3) || (!hasPin && step === 2)) && (
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2 text-center">
                  Konfirmasi PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                  placeholder="••••••"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                {confirmPin.length === 6 && confirmPin !== pin && (
                  <p className="mt-2 text-sm text-red-500 text-center">PIN tidak cocok</p>
                )}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep(hasPin ? 2 : 1)}
                    className="flex-1 rounded-lg border border-[rgb(var(--border))] py-3 font-medium"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={processing || confirmPin.length !== 6 || confirmPin !== pin}
                    className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {processing ? "Menyimpan..." : "Simpan PIN"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Security notice */}
          <div className="mt-6 rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div className="text-sm text-[rgb(var(--muted))]">
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
    </>
  );
}
