"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
} from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";

function normalizeWallet(payload) {
  const data = unwrapFeatureData(payload) || {};
  const balanceRaw =
    data.balance ?? data.Balance ?? data.availableBalance ?? data.AvailableBalance ?? 0;
  const pinSetRaw =
    data.pinSet ?? data.PinSet ?? data.pin_set ?? data.hasPin ?? data.has_pin ?? false;

  return {
    balance: Number(balanceRaw) || 0,
    has_pin: Boolean(pinSetRaw),
  };
}

function normalizeSearchUser(payload) {
  const data = unwrapFeatureData(payload) || {};
  const existsRaw = data.exists ?? data.Exists;
  const userId = data.userId ?? data.UserId ?? data.user_id ?? null;
  const username = data.username ?? data.Username ?? "";
  const avatarUrl = data.avatarUrl ?? data.AvatarUrl ?? data.avatar_url ?? "";

  return {
    exists: typeof existsRaw === "boolean" ? existsRaw : Boolean(userId && username),
    userId: Number(userId) || 0,
    username: String(username || ""),
    avatarUrl: String(avatarUrl || ""),
  };
}

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
        // Get wallet and PIN status from Feature Service
        const walletData = normalizeWallet(
          await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME)
        );
        setWallet(walletData);

        // If PIN not set, redirect to set PIN page
        if (!walletData.has_pin) {
          router.push("/account/wallet/set-pin?redirect=send");
        }
      } catch (e) {
        logger.error("Failed to load wallet:", e);
        // Check for 2FA requirement
        if (e.code === "TWO_FACTOR_REQUIRED") {
          router.push("/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/send"));
        }
      }
    }
    loadWallet();
  }, [router]);

  // Search users
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setSearching(true);
        try {
          const userData = normalizeSearchUser(
            await fetchFeatureAuth(
            FEATURE_ENDPOINTS.TRANSFERS.SEARCH_USER + `?username=${encodeURIComponent(searchQuery)}`
          ));
          if (userData && userData.exists) {
            setSearchResults([{
              id: userData.userId,
              username: userData.username,
              avatar_url: userData.avatarUrl
            }]);
          } else {
            setSearchResults([]);
          }
        } catch (e) {
          logger.error("Search failed:", e);
          setSearchResults([]);
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
    if (!amountNum || amountNum < 10000) {
      setError("Minimum transfer adalah Rp 10.000");
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

    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.CREATE, {
        method: "POST",
        body: JSON.stringify({
          receiverUsername: selectedUser.username,
          amount: amountNum,
          holdHours: holdDays * 24, // Feature Service uses hours
          message: description,
          pin,
        }),
      });

      // Success - redirect to transactions page
      router.push("/account/wallet/transactions?success=transfer");
    } catch (e) {
      logger.error("Transfer failed:", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push("/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/send"));
        return;
      }
      setError(getErrorMessage(e, "Gagal mengirim uang"));
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    const num = parseInt(value.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  return (
    <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-lg px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Kirim Uang</h1>
            <p className="text-sm text-muted-foreground">
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
                      ? "bg-primary text-white"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-1 w-16 ${
                      step > s ? "bg-primary" : "bg-muted/50"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Current Balance */}
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Saldo Tersedia</div>
            <div className="text-xl font-bold text-foreground">
              Rp {wallet.balance.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Step 1: Select User */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Cari Penerima
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik username (min 3 karakter)"
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Search Results */}
              {searching && (
                <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground">
                  <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Mencari...
                </div>
              )}

              {!searching && searchQuery.length >= 3 && searchResults.length === 0 && (
                <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground">
                  <svg className="h-8 w-8 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>User tidak ditemukan</p>
                  <p className="text-xs mt-1">Username minimal 7 karakter</p>
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="rounded-lg border border-border bg-card divide-y divide-border">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted/50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
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
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {selectedUser?.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {selectedUser?.username}
                  </div>
                  <div className="text-xs text-muted-foreground">Penerima</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                    setStep(1);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Ubah
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Jumlah Transfer
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(formatCurrency(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-border bg-card px-10 py-3 text-lg font-semibold text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Hold Period */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Periode Hold
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Uang akan di-hold selama periode ini sebelum otomatis dikirim ke penerima. Anda bisa melepaskan lebih awal.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHoldDays(7)}
                    className={`rounded-lg border p-3 text-center transition ${
                      holdDays === 7
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary"
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
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary"
                    }`}
                  >
                    <div className="text-lg font-bold">30 Hari</div>
                    <div className="text-xs opacity-70">Transaksi Besar</div>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Pembayaran untuk jasa desain logo"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-border bg-card py-3 font-semibold text-foreground transition hover:bg-muted/50"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleAmountNext}
                  className="flex-1 rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90"
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
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Ringkasan Transfer</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Penerima</span>
                  <span className="font-medium text-foreground">{selectedUser?.username}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jumlah</span>
                  <span className="font-bold text-lg text-foreground">Rp {amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Periode Hold</span>
                  <span className="font-medium text-foreground">{holdDays} Hari</span>
                </div>
                {description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deskripsi</span>
                    <span className="font-medium text-foreground text-right max-w-48 truncate">{description}</span>
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Masukkan PIN Transaksi
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  maxLength={6}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-center text-2xl tracking-widest text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-border bg-card py-3 font-semibold text-foreground transition hover:bg-muted/50"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading || pin.length !== 6}
                  className="flex-1 rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
