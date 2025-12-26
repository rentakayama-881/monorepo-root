"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function SendMoneyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState({ balance: 0, has_pin: false });

  // Form data
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState("");
  const [holdDays, setHoldDays] = useState(7);
  const [description, setDescription] = useState("");
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
          
          // If PIN not set, redirect to set PIN page
          if (!data.has_pin) {
            router.push("/account/wallet/set-pin?redirect=/account/wallet/send");
          }
        }
      } catch (e) {
        console.error("Failed to load wallet:", e);
      }
    }
    loadWallet();
  }, [router]);

  // Search users
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setSearching(true);
        const token = getToken();
        try {
          const res = await fetch(
            `${getApiBase()}/api/transfers/search-user?username=${encodeURIComponent(searchQuery)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.users || []);
          }
        } catch (e) {
          console.error("Search failed:", e);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setSearchResults([]);
    setStep(2);
  };

  const handleAmountNext = () => {
    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum < 1000) {
      setError("Minimum transfer adalah Rp 1.000");
      return;
    }
    if (amountNum > wallet.balance) {
      setError("Saldo tidak mencukupi");
      return;
    }
    setError("");
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = getToken();
    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);

    try {
      const res = await fetch(`${getApiBase()}/api/transfers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver_username: selectedUser.username,
          amount: amountNum,
          hold_days: holdDays,
          description,
          pin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengirim uang");
        setLoading(false);
        return;
      }

      // Success - redirect to transactions page
      router.push("/account/wallet/transactions?success=transfer");
    } catch (e) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    const num = parseInt(value.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
        <div className="mx-auto max-w-lg px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Kirim Uang</h1>
            <p className="text-sm text-[rgb(var(--muted))]">
              Transfer uang ke pengguna lain dengan sistem escrow
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-6 flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    step >= s
                      ? "bg-emerald-600 text-white"
                      : "bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-1 w-16 ${
                      step > s ? "bg-emerald-600" : "bg-[rgb(var(--surface-2))]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Current Balance */}
          <div className="mb-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <div className="text-sm text-[rgb(var(--muted))]">Saldo Tersedia</div>
            <div className="text-xl font-bold text-[rgb(var(--fg))]">
              Rp {wallet.balance.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Step 1: Select User */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Cari Penerima
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik username (min 3 karakter)"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-[rgb(var(--fg))] placeholder-[rgb(var(--muted))] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Search Results */}
              {searching && (
                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-center text-[rgb(var(--muted))]">
                  <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Mencari...
                </div>
              )}

              {!searching && searchQuery.length >= 3 && searchResults.length === 0 && (
                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-center text-[rgb(var(--muted))]">
                  <svg className="h-8 w-8 mx-auto mb-2 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>User tidak ditemukan</p>
                  <p className="text-xs mt-1">Username minimal 7 karakter</p>
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] divide-y divide-[rgb(var(--border))]">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-[rgb(var(--surface-2))]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[rgb(var(--fg))]">
                          {user.username}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Amount & Hold Period */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Selected User */}
              <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                  {selectedUser?.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[rgb(var(--fg))]">
                    {selectedUser?.username}
                  </div>
                  <div className="text-xs text-[rgb(var(--muted))]">Penerima</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                    setStep(1);
                  }}
                  className="text-sm text-emerald-600 hover:underline"
                >
                  Ubah
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Jumlah Transfer
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(formatCurrency(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-10 py-3 text-lg font-semibold text-[rgb(var(--fg))] placeholder-[rgb(var(--muted))] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Hold Period */}
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Periode Hold
                </label>
                <p className="text-xs text-[rgb(var(--muted))] mb-2">
                  Uang akan di-hold selama periode ini sebelum otomatis dikirim ke penerima. Anda bisa melepaskan lebih awal.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHoldDays(7)}
                    className={`rounded-lg border p-3 text-center transition ${
                      holdDays === 7
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))] hover:border-emerald-500"
                    }`}
                  >
                    <div className="text-lg font-bold">7 Hari</div>
                    <div className="text-xs opacity-70">Rekomendasi</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoldDays(30)}
                    className={`rounded-lg border p-3 text-center transition ${
                      holdDays === 30
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))] hover:border-emerald-500"
                    }`}
                  >
                    <div className="text-lg font-bold">30 Hari</div>
                    <div className="text-xs opacity-70">Transaksi Besar</div>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Pembayaran untuk jasa desain logo"
                  rows={2}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-[rgb(var(--fg))] placeholder-[rgb(var(--muted))] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-3 font-semibold text-[rgb(var(--fg))] transition hover:bg-[rgb(var(--surface-2))]"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleAmountNext}
                  className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm & PIN */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 space-y-3">
                <h3 className="font-semibold text-[rgb(var(--fg))]">Ringkasan Transfer</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Penerima</span>
                  <span className="font-medium text-[rgb(var(--fg))]">{selectedUser?.username}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Jumlah</span>
                  <span className="font-bold text-lg text-[rgb(var(--fg))]">Rp {amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Periode Hold</span>
                  <span className="font-medium text-[rgb(var(--fg))]">{holdDays} Hari</span>
                </div>
                {description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[rgb(var(--muted))]">Deskripsi</span>
                    <span className="font-medium text-[rgb(var(--fg))] text-right max-w-48 truncate">{description}</span>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm text-blue-600">
                <p>
                  Uang akan di-hold selama {holdDays} hari. Setelah periode hold berakhir, uang akan otomatis dikirim ke {selectedUser?.username}. Anda dapat melepaskan uang lebih awal dari menu Transaksi.
                </p>
              </div>

              {/* PIN */}
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--fg))] mb-2">
                  Masukkan PIN Transaksi
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  maxLength={6}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-center text-2xl tracking-widest text-[rgb(var(--fg))] placeholder-[rgb(var(--muted))] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-3 font-semibold text-[rgb(var(--fg))] transition hover:bg-[rgb(var(--surface-2))]"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading || pin.length !== 6}
                  className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Kirim Uang"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
  );
}
