"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

export default function DepositPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState({ balance: 0 });

  useEffect(() => {
    async function loadWallet() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const walletData = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
        setWallet({ balance: walletData.balance || 0 });
      } catch (e) {
        logger.error("Failed to load wallet:", e);
      }
    }
    loadWallet();
  }, [router]);

  const quickAmounts = [50000, 100000, 200000, 500000, 1000000];

  const handleDeposit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum < 10000) {
      setError("Minimum deposit adalah Rp 10.000");
      setLoading(false);
      return;
    }

    // TODO: Implement deposit endpoint in Feature Service with payment gateway integration
    setError("Fitur deposit sedang dalam pengembangan. Silakan hubungi admin untuk top-up manual.");
    setLoading(false);
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
            <h1 className="text-2xl font-bold text-foreground">Deposit</h1>
            <p className="text-sm text-muted-foreground">
              Isi saldo ke wallet Anda
            </p>
          </div>

          {/* Current Balance */}
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Saldo Saat Ini</div>
            <div className="text-2xl font-bold text-foreground">
              Rp {wallet.balance.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Deposit Form */}
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Jumlah Deposit
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
              <p className="mt-1 text-xs text-muted-foreground">
                Minimum deposit Rp 10.000
              </p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toLocaleString("id-ID"))}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:bg-primary/10"
                >
                  {(amt / 1000).toLocaleString("id-ID")}rb
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !amount}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Memproses..." : "Lanjutkan ke Pembayaran"}
            </button>
          </form>

          {/* Payment Methods Info */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Metode Pembayaran yang Didukung
            </h3>
            <div className="grid grid-cols-4 gap-3 text-center text-xs text-muted-foreground">
              <div className="rounded-lg border border-border bg-card p-2">
                QRIS
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                OVO
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                DANA
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                GoPay
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                BCA
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                BNI
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                BRI
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                Mandiri
              </div>
            </div>
          </div>
        </div>
      </main>
  );
}
