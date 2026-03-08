"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";
import { PageLoadingBlock } from "@/components/ui/LoadingState";

const CRYPTO_CURRENCIES = [
  {
    value: "USDT",
    label: "Tether",
    symbol: "USDT",
    networks: ["TRC20", "ERC20", "BEP20", "Polygon", "SOL", "TON"],
    icon: (
      <svg viewBox="0 0 32 32" className="h-8 w-8">
        <circle cx="16" cy="16" r="16" fill="#26A17B" />
        <path
          d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
          fill="#fff"
        />
      </svg>
    ),
  },
  {
    value: "TON",
    label: "Toncoin",
    symbol: "TON",
    networks: ["TON"],
    icon: (
      <svg viewBox="0 0 32 32" className="h-8 w-8">
        <circle cx="16" cy="16" r="16" fill="#0098EA" />
        <path
          d="M21.767 10H10.233c-1.834 0-2.874 2.02-1.756 3.41l7.003 8.713a.93.93 0 001.04 0l7.003-8.713c1.118-1.39.078-3.41-1.756-3.41zm-7.25 2.12h-3.284l3.284 4.09V12.12zm2.966 4.09l3.284-4.09h-3.284v4.09z"
          fill="#fff"
        />
      </svg>
    ),
  },
];

const quickAmounts = [50000, 100000, 200000, 500000, 1000000];
const minWithdraw = 50000;
const feePercent = 0.02;

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

export default function WithdrawPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [cryptoCurrency, setCryptoCurrency] = useState("USDT");
  const [network, setNetwork] = useState("");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");

  const parsedAmount = parseInt(String(amount).replace(/\D/g, ""), 10) || 0;
  const fee = Math.ceil(parsedAmount * feePercent);
  const totalDeduction = parsedAmount + fee;

  const selectedCrypto = CRYPTO_CURRENCIES.find((c) => c.value === cryptoCurrency);
  const availableNetworks = selectedCrypto?.networks || [];

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    setNetwork(availableNetworks.length === 1 ? availableNetworks[0] : "");
  }, [cryptoCurrency]);

  async function loadData() {
    try {
      const walletRes = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
      const w = normalizeWallet(walletRes);
      setWallet(w);
      if (!w.has_pin) {
        router.push("/account/wallet/set-pin?redirect=withdraw");
        return;
      }
    } catch (e) {
      logger.error("Failed to load wallet data", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          `/account/security?setup2fa=true&redirect=${encodeURIComponent("/account/wallet/withdraw")}`
        );
        return;
      }
      setError(getErrorMessage(e, "Gagal memuat data"));
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    setProcessing(true);
    setError("");
    try {
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.WITHDRAWALS.CREATE, {
        method: "POST",
        body: JSON.stringify({
          amount: parsedAmount,
          cryptoAddress,
          cryptoCurrency,
          network: network || null,
          memo: memo || null,
          pin,
        }),
      });
      const data = unwrapFeatureData(response) || response;
      if (data.success === false || data.Success === false) {
        setError(data.error ?? data.Error ?? "Gagal membuat penarikan");
        setProcessing(false);
        return;
      }
      router.push("/account/wallet/withdraw/success");
    } catch (e) {
      logger.error("Failed to create withdrawal", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          `/account/security?setup2fa=true&redirect=${encodeURIComponent("/account/wallet/withdraw")}`
        );
        return;
      }
      setError(getErrorMessage(e, "Gagal memproses penarikan"));
    } finally {
      setProcessing(false);
    }
  }

  function handleAmountChange(e) {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      setAmount("");
      return;
    }
    setAmount(Number(raw).toLocaleString("id-ID"));
  }

  function handleQuickAmount(val) {
    setAmount(val.toLocaleString("id-ID"));
  }

  const isStep1Valid =
    cryptoCurrency && cryptoAddress.length >= 10 && (availableNetworks.length <= 1 || network);
  const isStep2Valid = parsedAmount >= minWithdraw && totalDeduction <= wallet.balance;

  if (loading) {
    return (
      <PageLoadingBlock className="min-h-screen bg-background" maxWidthClass="max-w-md" lines={4} />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
                setError("");
                if (step === 3) setPin("");
              } else {
                router.push("/account/wallet/transactions");
              }
            }}
            className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {step > 1 ? "Kembali" : "Wallet"}
          </button>
          <h1 className="text-xl font-bold text-foreground">Penarikan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saldo: Rp{wallet.balance.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* STEP 1: Crypto & Address */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Crypto Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Pilih Mata Uang
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CRYPTO_CURRENCIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCryptoCurrency(c.value)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all ${
                      cryptoCurrency === c.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                  >
                    {c.icon}
                    <div className="text-left">
                      <div className="text-sm font-semibold text-foreground">{c.symbol}</div>
                      <div className="text-xs text-muted-foreground">{c.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Network Selector */}
            {availableNetworks.length > 1 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Pilih Jaringan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableNetworks.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNetwork(n)}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                        network === n
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Address Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Alamat Wallet Tujuan
              </label>
              <input
                type="text"
                value={cryptoAddress}
                onChange={(e) => setCryptoAddress(e.target.value.trim())}
                placeholder="Masukkan alamat wallet"
                className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {cryptoAddress && cryptoAddress.length < 10 && (
                <p className="mt-1 text-xs text-destructive">Alamat wallet terlalu pendek</p>
              )}
            </div>

            {/* Memo for TON */}
            {(cryptoCurrency === "TON" || network === "TON") && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Memo <span className="text-muted-foreground">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Memo jika diperlukan"
                  className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-xs text-yellow-800">
                ⚠️ Pastikan alamat dan jaringan sudah benar. Pengiriman ke alamat atau jaringan yang
                salah tidak dapat dikembalikan.
              </p>
            </div>

            <button
              disabled={!isStep1Valid}
              onClick={() => {
                setStep(2);
                setError("");
              }}
              className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lanjutkan
            </button>
          </div>
        )}

        {/* STEP 2: Amount */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Tujuan</div>
              <div className="text-sm font-mono font-medium truncate">{cryptoAddress}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {cryptoCurrency}
                {network ? ` • ${network}` : ""}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Jumlah Penarikan
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickAmounts.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAmount(val)}
                    className="rounded-full border border-input px-3 py-1 text-xs hover:bg-accent transition-colors"
                  >
                    {(val / 1000).toLocaleString("id-ID")}rb
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const maxAmount = Math.floor(wallet.balance / (1 + feePercent));
                    if (maxAmount > 0) handleQuickAmount(maxAmount);
                  }}
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                >
                  Maks
                </button>
              </div>
            </div>

            {parsedAmount >= minWithdraw && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jumlah penarikan</span>
                  <span>Rp{parsedAmount.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Biaya layanan</span>
                  <span>Rp{fee.toLocaleString("id-ID")}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total dipotong dari saldo</span>
                  <span>Rp{totalDeduction.toLocaleString("id-ID")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rp{parsedAmount.toLocaleString("id-ID")} akan dikonversi ke {cryptoCurrency} dan
                  dikirim ke alamat tujuan
                </p>
              </div>
            )}

            {totalDeduction > wallet.balance && parsedAmount > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                Saldo tidak cukup. Diperlukan Rp{totalDeduction.toLocaleString("id-ID")}
              </div>
            )}

            <button
              disabled={!isStep2Valid}
              onClick={() => {
                setStep(3);
                setError("");
              }}
              className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lanjutkan
            </button>
          </div>
        )}

        {/* STEP 3: Confirmation & PIN */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Konfirmasi Penarikan</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mata uang</span>
                  <span className="font-medium">
                    {cryptoCurrency}
                    {network ? ` (${network})` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alamat tujuan</span>
                  <span className="font-mono text-xs max-w-[200px] truncate">{cryptoAddress}</span>
                </div>
                {memo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memo</span>
                    <span className="font-mono text-xs">{memo}</span>
                  </div>
                )}
                <hr className="border-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah penarikan</span>
                  <span>Rp{parsedAmount.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Biaya layanan</span>
                  <span>Rp{fee.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total dipotong</span>
                  <span>Rp{totalDeduction.toLocaleString("id-ID")}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Masukkan PIN Wallet
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="h-14 w-full rounded-lg border border-input bg-background px-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground text-center">
                Masukkan 6 digit PIN wallet Anda
              </p>
            </div>

            <button
              disabled={pin.length !== 6 || processing}
              onClick={handleWithdraw}
              className="h-12 w-full rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? "Memproses..." : "Konfirmasi Penarikan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
