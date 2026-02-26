"use client";
import { useState, useEffect } from "react";
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
import NativeSelect from "@/components/ui/NativeSelect";

const QRIS_IMAGE_URL =
  "https://i.ibb.co.com/TDR9Grs3/Kode-QRIS-ALEPHDRAAD-UTILITY-STACK-Elektronik-1.png";

const PAYMENT_METHODS = [
  { value: "QRIS", label: "QRIS (aktif)", enabled: true },
  { value: "BCA", label: "BCA (unavailable)", enabled: false },
  { value: "BNI", label: "BNI (unavailable)", enabled: false },
  { value: "BRI", label: "BRI (unavailable)", enabled: false },
  { value: "MANDIRI", label: "Mandiri (unavailable)", enabled: false },
  { value: "OVO", label: "OVO (unavailable)", enabled: false },
  { value: "DANA", label: "DANA (unavailable)", enabled: false },
  { value: "GOPAY", label: "GoPay (unavailable)", enabled: false },
  { value: "SHOPEEPAY", label: "ShopeePay (unavailable)", enabled: false },
];

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
    method: item?.method ?? item?.Method ?? "QRIS",
    externalTransactionId:
      item?.externalTransactionId ??
      item?.ExternalTransactionId ??
      item?.external_transaction_id ??
      "",
    status: item?.status ?? item?.Status ?? "Pending",
    createdAt: item?.createdAt ?? item?.CreatedAt ?? item?.created_at ?? null,
  };
}

function extractDeposits(payload) {
  const data = unwrapFeatureData(payload);
  return extractFeatureItems(data).map(normalizeDeposit).filter((d) => d.id);
}

export default function DepositPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [method, setMethod] = useState("QRIS");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState({ balance: 0, has_pin: false });
  const [createdDeposit, setCreatedDeposit] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [depositHistory, setDepositHistory] = useState([]);

  useEffect(() => {
    async function loadWalletAndGate() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const walletData = normalizeWallet(
          await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME)
        );
        setWallet(walletData);
        const pinSet = walletData.has_pin;

        if (!pinSet) {
          router.push("/account/wallet/set-pin?redirect=deposit");
          return;
        }

        // Load deposit request history (manual deposits)
        setHistoryLoading(true);
        setHistoryError("");
        try {
          const historyRes = await fetchFeatureAuth(
            FEATURE_ENDPOINTS.WALLETS.DEPOSITS + "?limit=10"
          );
          setDepositHistory(extractDeposits(historyRes));
        } catch (e) {
          logger.error("Failed to load deposit history:", e);
          setHistoryError(getErrorMessage(e, "Unable to load deposit history."));
        }
      } catch (e) {
        logger.error("Failed to load wallet:", e);
        if (e.code === "TWO_FACTOR_REQUIRED") {
          router.push(
            "/account/security?setup2fa=true&redirect=" +
              encodeURIComponent("/account/wallet/deposit")
          );
          return;
        }
        setError(getErrorMessage(e, "Unable to load wallet data."));
      } finally {
        setHistoryLoading(false);
        setLoading(false);
      }
    }
    loadWalletAndGate();
  }, [router]);

  const quickAmounts = [50000, 100000, 200000, 500000, 1000000];
  const defaultBackRoute = "/account/wallet/transactions";

  const amountNum = parseInt(amount.replace(/\D/g, ""), 10) || 0;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(defaultBackRoute);
  };

  const handleNextToPayment = () => {
    setError("");
    if (!amountNum || amountNum < 10000) {
      setError("Minimum deposit adalah Rp 10.000");
      return;
    }
    setStep(2);
  };

  const handleCheckPayment = async () => {
    setError("");
    setSubmitting(true);

    if (method !== "QRIS") {
      setError("Saat ini hanya deposit via QRIS yang tersedia.");
      setSubmitting(false);
      return;
    }

    if (!transactionId || transactionId.trim().length < 6) {
      setError("Invalid transaction ID");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSITS, {
        method: "POST",
        body: JSON.stringify({
          amount: amountNum,
          method,
          externalTransactionId: transactionId.trim(),
        }),
      });

      const deposit = normalizeDeposit(unwrapFeatureData(res));
      setCreatedDeposit(deposit);
      setStep(3);

      // Refresh history best-effort
      try {
        const historyRes = await fetchFeatureAuth(
          FEATURE_ENDPOINTS.WALLETS.DEPOSITS + "?limit=10"
        );
        setDepositHistory(extractDeposits(historyRes));
      } catch (e) {
        logger.error("Failed to refresh deposit history:", e);
      }
    } catch (e) {
      logger.error("Create deposit request failed:", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          "/account/security?setup2fa=true&redirect=" +
            encodeURIComponent("/account/wallet/deposit")
        );
        return;
      }
      setError(getErrorMessage(e, "Unable to create deposit request."));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    const num = parseInt(value.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status) => {
    const normalized = (status || "").toLowerCase();
    const styles = {
      pending: "bg-warning/10 text-warning border-warning/30",
      approved: "bg-success/10 text-success border-success/30",
      rejected: "bg-destructive/10 text-destructive border-destructive/30",
    };
    const labels = {
      pending: "Pending Verification",
      approved: "Disetujui",
      rejected: "Rejected",
    };
    return (
      <span
        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
          styles[normalized] || styles.pending
        }`}
      >
        {labels[normalized] || status || "Pending"}
      </span>
    );
  };

  if (loading) {
    return <PageLoadingBlock className="min-h-screen bg-background" maxWidthClass="max-w-lg" lines={4} />;
  }

  return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <button
            type="button"
            onClick={handleBack}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Deposit</h1>
            <p className="text-sm text-muted-foreground">
              Add funds to your wallet
            </p>
          </div>

          {/* Current Balance */}
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Current Balance</div>
            <div className="text-2xl font-bold text-foreground">
              Rp {wallet.balance.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mb-6 flex items-center justify-between gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    step >= s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-1 w-8 sm:w-16 md:w-24 ${
                      step > s ? "bg-primary" : "bg-muted/50"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Amount + Method */}
          {step === 1 && (
            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Metode Pembayaran
                </label>
                <NativeSelect
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  options={PAYMENT_METHODS.map((item) => ({
                    value: item.value,
                    label: item.label,
                    disabled: !item.enabled,
                  }))}
                  className="h-12 py-3 text-sm font-medium"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Saat ini hanya QRIS yang tersedia. Metode lain segera menyusul.
                </p>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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

              <button
                type="button"
                onClick={handleNextToPayment}
                disabled={!amount}
                className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Lanjutkan ke Pembayaran
              </button>
            </div>
          )}

          {/* Step 2: QR + External Transaction Id */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">Nominal</div>
                <div className="text-xl font-bold text-foreground">
                  Rp {amountNum.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 text-sm font-medium text-foreground">
                  QRIS
                </div>
                <div className="flex justify-center">
                  <img
                    src={QRIS_IMAGE_URL}
                    alt="QRIS Deposit"
                    className="h-auto w-full max-w-72 rounded-lg border border-border bg-white p-2"
                    loading="lazy"
                  />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Scan the QRIS code, pay the exact amount, then enter your transaction ID.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter payment transaction ID"
                  className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-border py-3 font-medium text-foreground transition hover:bg-muted/50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCheckPayment}
                  disabled={submitting || !transactionId}
                  className="flex-1 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Memproses..." : "Check Pembayaran"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-7 w-7 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Menunggu verifikasi admin
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your deposit is being processed. Our team will verify your QRIS payment.
              </p>

              {createdDeposit?.id && (
                <div className="mt-4 rounded-lg border border-border bg-background p-4 text-left">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">ID Request</div>
                      <div className="font-mono text-sm text-foreground break-all">
                        {createdDeposit.id}
                      </div>
                    </div>
                    {statusBadge(createdDeposit.status)}
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="text-muted-foreground">Nominal</div>
                    <div className="font-semibold text-foreground">
                      Rp {createdDeposit.amount?.toLocaleString("id-ID") || amountNum.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setAmount("");
                  setTransactionId("");
                  setMethod("QRIS");
                  setCreatedDeposit(null);
                  setStep(1);
                  setError("");
                }}
                className="mt-6 w-full rounded-lg border border-border py-3 font-medium text-foreground transition hover:bg-muted/50"
              >
                Buat request deposit baru
              </button>
            </div>
          )}

          {/* Payment Methods Info */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Metode Pembayaran yang Didukung
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground sm:grid-cols-4">
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

          {/* Deposit History */}
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Manual Deposit History
            </h3>

            {historyError && (
              <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {historyError}
              </div>
            )}

            {historyLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-16 bg-border rounded-lg" />
                <div className="h-16 bg-border rounded-lg" />
              </div>
            ) : depositHistory.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Belum ada request deposit.
              </div>
            ) : (
              <div className="space-y-3">
                {depositHistory.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium text-foreground">
                          Rp {d.amount?.toLocaleString("id-ID") || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.method} • {formatDate(d.createdAt)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Transaction ID: <span className="font-mono break-all">{d.externalTransactionId}</span>
                        </div>
                      </div>
                      <div className="self-start sm:self-auto">{statusBadge(d.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
