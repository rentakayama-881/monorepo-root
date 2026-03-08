"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
  extractFeatureItems,
} from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";
import { PageLoadingBlock } from "@/components/ui/LoadingState";

const CRYPTO_OPTIONS = [
  {
    value: "USDT",
    label: "Tether",
    symbol: "USDT",
    networks: ["TRC20", "TON", "BEP20", "ERC20", "Polygon", "SOL"],
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

const quickAmounts = [2000, 5000, 10000, 50000, 100000];
const minDeposit = 2000;

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

function normalizeDeposit(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    amount: Number(item?.amount ?? item?.Amount ?? 0) || 0,
    payCurrency: item?.payCurrency ?? item?.PayCurrency ?? "",
    payAmount: item?.payAmount ?? item?.PayAmount ?? "",
    network: item?.network ?? item?.Network ?? "",
    status: item?.status ?? item?.Status ?? "WaitingPayment",
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    platformFee: Number(item?.platformFee ?? item?.PlatformFee ?? 0) || 0,
  };
}

function getStatusLabel(status) {
  const s = String(status).toLowerCase();
  if (s === "waitingpayment" || s === "waiting_payment" || s === "0")
    return {
      label: "Menunggu Pembayaran",
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    };
  if (s === "confirming" || s === "1")
    return { label: "Mengonfirmasi", color: "text-blue-600 bg-blue-50 border-blue-200" };
  if (s === "paid" || s === "2")
    return { label: "Terbayar", color: "text-green-600 bg-green-50 border-green-200" };
  if (s === "approved" || s === "3")
    return { label: "Berhasil", color: "text-green-700 bg-green-100 border-green-300" };
  if (s === "expired" || s === "4")
    return { label: "Kedaluwarsa", color: "text-gray-500 bg-gray-50 border-gray-200" };
  if (s === "failed" || s === "5")
    return { label: "Gagal", color: "text-red-600 bg-red-50 border-red-200" };
  return { label: status, color: "text-gray-600 bg-gray-50 border-gray-200" };
}

function formatCountdown(seconds) {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DepositPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [amount, setAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");

  const [depositData, setDepositData] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  const [depositHistory, setDepositHistory] = useState([]);

  const parsedAmount = parseInt(String(amount).replace(/\D/g, ""), 10) || 0;
  const platformFee = Math.ceil(parsedAmount / 0.95) - parsedAmount;
  const totalCharge = parsedAmount + platformFee;

  const selectedCrypto = CRYPTO_OPTIONS.find((c) => c.value === payCurrency);
  const availableNetworks = selectedCrypto?.networks || [];

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (availableNetworks.length === 1) {
      setNetwork(availableNetworks[0]);
    } else if (availableNetworks.length > 1) {
      setNetwork(availableNetworks[0]);
    }
  }, [payCurrency]);

  async function loadData() {
    try {
      const [walletRes, historyRes] = await Promise.allSettled([
        fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME),
        fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSITS + "?limit=10"),
      ]);

      if (walletRes.status === "fulfilled") {
        const w = normalizeWallet(walletRes.value);
        setWallet(w);
        if (!w.has_pin) {
          router.push("/account/wallet/set-pin?redirect=deposit");
          return;
        }
      }

      if (historyRes.status === "fulfilled") {
        const items = extractFeatureItems(historyRes.value) || [];
        setDepositHistory(items.map(normalizeDeposit));
      }
    } catch (e) {
      logger.error("Failed to load deposit data", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          `/account/security?setup2fa=true&redirect=${encodeURIComponent("/account/wallet/deposit")}`
        );
        return;
      }
      setError(getErrorMessage(e, "Gagal memuat data"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDeposit() {
    if (parsedAmount < minDeposit) {
      setError(`Minimal deposit Rp${minDeposit.toLocaleString("id-ID")}`);
      return;
    }
    setProcessing(true);
    setError("");

    try {
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSITS, {
        method: "POST",
        body: JSON.stringify({
          amount: parsedAmount,
          payCurrency,
          network: network || null,
        }),
      });

      const data = unwrapFeatureData(response) || response;
      const deposit = {
        id: data.id ?? data.Id ?? data.depositId ?? data.DepositId ?? "",
        trackId: data.trackId ?? data.TrackId ?? "",
        address: data.address ?? data.Address ?? "",
        qrCode: data.qrCode ?? data.QrCode ?? "",
        payAmount: data.payAmount ?? data.PayAmount ?? "",
        payCurrency: data.payCurrency ?? data.PayCurrency ?? payCurrency,
        network: data.network ?? data.Network ?? "",
        rate: data.rate ?? data.Rate ?? "",
        expiredAt: Number(data.expiredAt ?? data.ExpiredAt ?? 0),
        platformFee: Number(data.platformFee ?? data.PlatformFee ?? 0),
        amount: Number(data.amount ?? data.Amount ?? parsedAmount),
      };

      setDepositData(deposit);
      setStep(2);
      startCountdown(deposit.expiredAt);
      startPolling(deposit.id);
    } catch (e) {
      logger.error("Failed to create deposit", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          `/account/security?setup2fa=true&redirect=${encodeURIComponent("/account/wallet/deposit")}`
        );
        return;
      }
      setError(getErrorMessage(e, "Gagal membuat deposit"));
    } finally {
      setProcessing(false);
    }
  }

  function startCountdown(expiredAtUnix) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiredAtUnix - now;
      setCountdown(remaining > 0 ? remaining : 0);
      if (remaining <= 0 && countdownRef.current) clearInterval(countdownRef.current);
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
  }

  function startPolling(depositId) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSIT_STATUS(depositId));
        const data = unwrapFeatureData(res) || res;
        const status = String(data.status ?? data.Status ?? "").toLowerCase();

        if (status === "approved" || status === "3") {
          clearInterval(pollRef.current);
          clearInterval(countdownRef.current);
          setStep(3);
          loadData();
        } else if (
          status === "expired" ||
          status === "4" ||
          status === "failed" ||
          status === "5"
        ) {
          clearInterval(pollRef.current);
          clearInterval(countdownRef.current);
          setError("Deposit kedaluwarsa atau gagal. Silakan buat deposit baru.");
          setStep(1);
          setDepositData(null);
        }
      } catch (e) {
        logger.warn("Deposit status poll error", e);
      }
    }, 5000);
  }

  const handleCopyAddress = useCallback(() => {
    if (depositData?.address) {
      navigator.clipboard.writeText(depositData.address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [depositData]);

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
              if (step === 2) {
                if (pollRef.current) clearInterval(pollRef.current);
                if (countdownRef.current) clearInterval(countdownRef.current);
                setStep(1);
                setDepositData(null);
                setError("");
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
            {step === 2 ? "Kembali" : "Wallet"}
          </button>
          <h1 className="text-xl font-bold text-foreground">Deposit</h1>
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Saldo saat ini</span>
            <span className="text-sm font-bold text-foreground">
              Rp{wallet.balance.toLocaleString("id-ID")}
            </span>
          </div>
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

        {/* STEP 1: Amount & Crypto Selection */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Crypto Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Pilih Mata Uang
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CRYPTO_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setPayCurrency(c.value)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all ${
                      payCurrency === c.value
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

            {/* Amount Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Jumlah Deposit
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
              </div>
            </div>

            {/* Fee Summary */}
            {parsedAmount >= minDeposit && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jumlah deposit</span>
                  <span>Rp{parsedAmount.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Biaya layanan</span>
                  <span>Rp{platformFee.toLocaleString("id-ID")}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total pembayaran</span>
                  <span>Rp{totalCharge.toLocaleString("id-ID")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total akan dikonversi ke {payCurrency} dengan kurs saat pembayaran. Biaya jaringan
                  blockchain sudah termasuk dalam jumlah kripto yang ditampilkan.
                </p>
              </div>
            )}

            <button
              disabled={parsedAmount < minDeposit || processing || !network}
              onClick={handleCreateDeposit}
              className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? "Memproses..." : "Lanjutkan"}
            </button>
          </div>
        )}

        {/* STEP 2: Payment Details */}
        {step === 2 && depositData && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4 text-center space-y-3">
              <div className="text-sm text-muted-foreground">Kirim tepat</div>
              <div className="text-2xl font-bold text-foreground">
                {depositData.payAmount} {depositData.payCurrency}
              </div>
              <div className="text-xs text-muted-foreground">
                Jaringan: <span className="font-medium text-foreground">{depositData.network}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Jumlah di atas sudah termasuk semua biaya
              </p>
            </div>

            {depositData.qrCode && (
              <div className="flex justify-center">
                <div className="rounded-lg border border-border bg-white p-3">
                  <img src={depositData.qrCode} alt="QR Code pembayaran" className="h-48 w-48" />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Alamat Pembayaran
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={depositData.address}
                  className="h-10 flex-1 rounded-lg border border-input bg-muted/30 px-3 text-xs font-mono"
                />
                <button
                  onClick={handleCopyAddress}
                  className="h-10 rounded-lg border border-input px-3 text-sm hover:bg-accent transition-colors"
                >
                  {copied ? "✓" : "Salin"}
                </button>
              </div>
            </div>

            {/* Countdown */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Sisa waktu pembayaran</div>
              <div
                className={`text-3xl font-mono font-bold ${countdown <= 300 ? "text-destructive" : "text-foreground"}`}
              >
                {formatCountdown(countdown)}
              </div>
              {countdown <= 0 && (
                <p className="mt-2 text-xs text-destructive">
                  Waktu habis. Silakan buat deposit baru.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 space-y-1">
              <p className="text-xs text-yellow-800 font-medium">⚠️ Perhatian</p>
              <ul className="text-xs text-yellow-700 space-y-0.5 list-disc pl-4">
                <li>Kirim tepat sesuai jumlah yang tertera</li>
                <li>
                  Pastikan jaringan yang digunakan adalah <strong>{depositData.network}</strong>
                </li>
                <li>Alamat hanya berlaku selama waktu yang ditentukan</li>
                <li>Saldo otomatis masuk setelah konfirmasi jaringan</li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Menunggu pembayaran...
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 3 && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">Deposit Berhasil!</h2>
            <p className="text-sm text-muted-foreground">
              Saldo Anda telah ditambahkan sebesar Rp
              {depositData?.amount?.toLocaleString("id-ID") ?? "0"}
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo saat ini</span>
                <span className="font-semibold">Rp{wallet.balance.toLocaleString("id-ID")}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setStep(1);
                setDepositData(null);
                setAmount("");
                setError("");
              }}
              className="h-10 w-full rounded-lg border border-input text-sm hover:bg-accent transition-colors"
            >
              Deposit Lagi
            </button>
            <button
              onClick={() => router.push("/account/wallet/transactions")}
              className="h-10 w-full rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              Kembali ke Wallet
            </button>
          </div>
        )}

        {/* Deposit History */}
        {depositHistory.length > 0 && step !== 2 && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Riwayat Deposit</h3>
            <div className="space-y-2">
              {depositHistory.map((d) => {
                const statusInfo = getStatusLabel(d.status);
                return (
                  <div key={d.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          Rp{d.amount.toLocaleString("id-ID")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.payCurrency}
                          {d.payAmount ? ` • ${d.payAmount}` : ""}
                          {d.network ? ` • ${d.network}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                        {d.createdAt && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(
                              typeof d.createdAt === "number" && d.createdAt < 1e12
                                ? d.createdAt * 1000
                                : d.createdAt
                            ).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
