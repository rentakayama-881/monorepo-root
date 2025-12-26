"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

const BANKS = [
  { code: "bca", name: "Bank Central Asia (BCA)" },
  { code: "bni", name: "Bank Negara Indonesia (BNI)" },
  { code: "bri", name: "Bank Rakyat Indonesia (BRI)" },
  { code: "mandiri", name: "Bank Mandiri" },
  { code: "cimb", name: "CIMB Niaga" },
  { code: "permata", name: "Bank Permata" },
  { code: "danamon", name: "Bank Danamon" },
  { code: "bsi", name: "Bank Syariah Indonesia (BSI)" },
];

export default function WithdrawPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    async function loadWallet() {
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
          setWallet(data);
          if (!data.has_pin) {
            router.push("/account/wallet/set-pin?redirect=withdraw");
          }
        }
      } catch (e) {
        logger.error("Failed to load wallet:", e);
      }
      setLoading(false);
    }

    loadWallet();
  }, [router]);

  const parsedAmount = parseInt(amount.replace(/\D/g, "")) || 0;
  const fee = 6500; // Bank transfer fee
  const totalDeduction = parsedAmount + fee;

  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value) {
      setAmount(parseInt(value).toLocaleString("id-ID"));
    } else {
      setAmount("");
    }
  };

  const isStep1Valid = bankCode && accountNumber.length >= 10 && accountName;
  const isStep2Valid = parsedAmount >= 50000 && totalDeduction <= wallet.balance;

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      setError("PIN harus 6 digit");
      return;
    }

    const token = getToken();
    setProcessing(true);
    setError("");

    try {
      const res = await fetch(`${getApiBase()}/api/withdrawals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parsedAmount,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          pin,
        }),
      });

      if (res.ok) {
        router.push("/account/wallet/withdraw/success");
      } else {
        const data = await res.json();
        setError(data.error || "Gagal memproses penarikan");
      }
    } catch (e) {
      setError("Terjadi kesalahan");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-[rgb(var(--muted))]">
          Memuat...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
        <div className="mx-auto max-w-md px-4 py-8">
          <Link
            href="/account/wallet/transactions"
            className="mb-6 inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </Link>

          <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-2">Tarik Dana</h1>
          <p className="text-sm text-[rgb(var(--muted))] mb-6">
            Transfer saldo ke rekening bank Anda
          </p>

          {/* Balance Card */}
          <div className="mb-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <div className="text-sm text-[rgb(var(--muted))]">Saldo Tersedia</div>
            <div className="text-2xl font-bold text-[rgb(var(--fg))]">
              Rp {wallet.balance.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                    step >= s
                      ? "bg-emerald-600 text-white"
                      : "bg-[rgb(var(--surface))] text-[rgb(var(--muted))] border border-[rgb(var(--border))]"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-0.5 w-8 transition ${
                      step > s ? "bg-emerald-600" : "bg-[rgb(var(--border))]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Step 1: Bank Details */}
          {step === 1 && (
            <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
              <h2 className="font-semibold text-[rgb(var(--fg))] mb-4">Informasi Rekening</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                    Bank
                  </label>
                  <select
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Pilih bank</option>
                    {BANKS.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="Masukkan nomor rekening"
                    className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-4 py-3 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                    Nama Pemilik Rekening
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                    placeholder="Masukkan nama sesuai rekening"
                    className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-4 py-3 uppercase focus:outline-none focus:border-emerald-500"
                  />
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                    Pastikan nama sesuai dengan rekening bank
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="mt-6 w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Lanjutkan
              </button>
            </div>
          )}

          {/* Step 2: Amount */}
          {step === 2 && (
            <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
              <h2 className="font-semibold text-[rgb(var(--fg))] mb-4">Jumlah Penarikan</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Nominal
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent py-3 pl-12 pr-4 text-xl font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                  Minimum penarikan Rp 50.000
                </p>
              </div>

              {/* Quick amounts */}
              <div className="mb-6 grid grid-cols-3 gap-2">
                {[100000, 250000, 500000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toLocaleString("id-ID"))}
                    disabled={val + fee > wallet.balance}
                    className="rounded-lg border border-[rgb(var(--border))] py-2 text-sm font-medium transition hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
                  >
                    {(val / 1000).toLocaleString("id-ID")}rb
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-[rgb(var(--bg))] p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Jumlah penarikan</span>
                  <span className="text-[rgb(var(--fg))]">
                    Rp {parsedAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Biaya transfer</span>
                  <span className="text-[rgb(var(--fg))]">Rp {fee.toLocaleString("id-ID")}</span>
                </div>
                <div className="border-t border-[rgb(var(--border))] pt-2 flex justify-between font-semibold">
                  <span className="text-[rgb(var(--fg))]">Total dipotong</span>
                  <span className="text-[rgb(var(--fg))]">
                    Rp {totalDeduction.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {totalDeduction > wallet.balance && parsedAmount > 0 && (
                <p className="mt-2 text-sm text-red-500">Saldo tidak mencukupi</p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-[rgb(var(--border))] py-3 font-medium transition hover:bg-[rgb(var(--bg))]"
                >
                  Kembali
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!isStep2Valid}
                  className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
              <h2 className="font-semibold text-[rgb(var(--fg))] mb-4">Konfirmasi Penarikan</h2>

              {/* Summary */}
              <div className="rounded-lg bg-[rgb(var(--bg))] p-4 mb-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Bank</span>
                  <span className="text-[rgb(var(--fg))] font-medium">
                    {BANKS.find((b) => b.code === bankCode)?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Nomor Rekening</span>
                  <span className="text-[rgb(var(--fg))] font-medium">{accountNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Nama</span>
                  <span className="text-[rgb(var(--fg))] font-medium">{accountName}</span>
                </div>
                <div className="border-t border-[rgb(var(--border))] pt-3 flex justify-between">
                  <span className="text-[rgb(var(--muted))]">Akan diterima</span>
                  <span className="text-lg font-bold text-emerald-600">
                    Rp {parsedAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Masukkan PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="mb-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                <div className="flex gap-2 text-sm text-yellow-600">
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    Dana akan ditransfer dalam 1-3 hari kerja
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-[rgb(var(--border))] py-3 font-medium transition hover:bg-[rgb(var(--bg))]"
                >
                  Kembali
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing || pin.length !== 6}
                  className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {processing ? "Memproses..." : "Tarik Dana"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
  );
}
