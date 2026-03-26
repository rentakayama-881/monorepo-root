import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import {
  CRYPTO_OPTIONS,
  minDeposit,
  normalizeWallet,
  normalizeDeposit,
  normalizeNetworkName,
} from "./deposit-utils";

export default function useDeposit() {
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
  const [countdownTotal, setCountdownTotal] = useState(0);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  const [depositHistory, setDepositHistory] = useState([]);
  const [cancelling, setCancelling] = useState(false);

  const parsedAmount = parseInt(String(amount).replace(/\D/g, ""), 10) || 0;
  const platformFee = Math.ceil(parsedAmount / 0.95) - parsedAmount;
  const totalCharge = parsedAmount + platformFee;

  const selectedCrypto = CRYPTO_OPTIONS.find((c) => c.value === payCurrency);
  const availableNetworks = useMemo(() => selectedCrypto?.networks || [], [selectedCrypto]);

  function resetDepositState() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setDepositData(null);
    setCountdown(0);
    setCountdownTotal(0);
    setAmount("");
    setPayCurrency("USDT");
    setNetwork("TRC20");
    setError("");
    setCopied(false);
    setProcessing(false);
    setCancelling(false);
  }

  function isDepositDataComplete(data) {
    return (
      data &&
      data.id &&
      data.address &&
      data.payAmount &&
      data.payCurrency &&
      data.network &&
      data.expiredAt > 0
    );
  }

  function startCountdown(expiredAtUnix) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const now = Math.floor(Date.now() / 1000);
    const initial = expiredAtUnix - now;
    if (initial > 0) setCountdownTotal(initial);
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
          status === "5" ||
          status === "cancelled" ||
          status === "6"
        ) {
          clearInterval(pollRef.current);
          clearInterval(countdownRef.current);
          setError("Deposit kedaluwarsa atau gagal. Silakan buat deposit baru.");
          resetDepositState();
          setStep(1);
        }
      } catch (e) {
        logger.warn("Deposit status poll error", e);
      }
    }, 5000);
  }

  async function loadData() {
    try {
      const [walletRes, historyRes, pendingRes] = await Promise.allSettled([
        fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME),
        fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSITS + "?limit=10"),
        fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSITS_PENDING),
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

      if (pendingRes.status === "fulfilled") {
        const pendingData = unwrapFeatureData(pendingRes.value) || pendingRes.value;
        const pendingId =
          pendingData?.id ??
          pendingData?.Id ??
          pendingData?.depositId ??
          pendingData?.DepositId ??
          "";
        if (pendingId) {
          const deposit = {
            id: pendingId,
            trackId: pendingData.trackId ?? pendingData.TrackId ?? "",
            address: pendingData.address ?? pendingData.Address ?? "",
            qrCode: pendingData.qrCode ?? pendingData.QrCode ?? "",
            payAmount: pendingData.payAmount ?? pendingData.PayAmount ?? "",
            payCurrency: pendingData.payCurrency ?? pendingData.PayCurrency ?? "USDT",
            network: normalizeNetworkName(pendingData.network ?? pendingData.Network ?? ""),
            rate: pendingData.rate ?? pendingData.Rate ?? "",
            expiredAt: Number(pendingData.expiredAt ?? pendingData.ExpiredAt ?? 0),
            platformFee: Number(pendingData.platformFee ?? pendingData.PlatformFee ?? 0),
            amount: Number(pendingData.amount ?? pendingData.Amount ?? 0),
          };
          const now = Math.floor(Date.now() / 1000);
          if (deposit.expiredAt > now && deposit.address) {
            setDepositData(deposit);
            setStep(2);
            startCountdown(deposit.expiredAt);
            startPolling(deposit.id);
          }
        }
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

  const loadDataRef = useRef(false);
  const loadDataFn = useRef(loadData);
  loadDataFn.current = loadData;

  useEffect(() => {
    if (loadDataRef.current) return;
    loadDataRef.current = true;
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadDataFn.current();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [router]);

  useEffect(() => {
    if (availableNetworks.length === 1) {
      setNetwork(availableNetworks[0]);
    } else if (availableNetworks.length > 1) {
      setNetwork(availableNetworks[0]);
    }
  }, [availableNetworks]);

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
        payCurrency: data.payCurrency ?? data.PayCurrency ?? "",
        network: normalizeNetworkName(data.network ?? data.Network ?? ""),
        rate: data.rate ?? data.Rate ?? "",
        expiredAt: Number(data.expiredAt ?? data.ExpiredAt ?? 0),
        platformFee: Number(data.platformFee ?? data.PlatformFee ?? 0),
        amount: Number(data.amount ?? data.Amount ?? 0),
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

  const handleCopyAddress = useCallback(() => {
    if (depositData?.address) {
      navigator.clipboard.writeText(depositData.address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [depositData]);

  async function handleCancelDeposit() {
    if (!depositData?.id || cancelling) return;
    setCancelling(true);
    setError("");
    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.DEPOSIT_CANCEL(depositData.id), {
        method: "POST",
      });
      resetDepositState();
      setStep(1);
    } catch (e) {
      logger.error("Failed to cancel deposit", e);
      setError(getErrorMessage(e, "Gagal membatalkan deposit"));
    } finally {
      setCancelling(false);
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

  const handleResetToStep1 = useCallback(() => {
    resetDepositState();
    setStep(1);
  }, []);

  return {
    router,
    step,
    loading,
    processing,
    error,
    copied,
    cancelling,
    wallet,
    amount,
    payCurrency,
    network,
    availableNetworks,
    depositData,
    countdown,
    countdownTotal,
    depositHistory,
    parsedAmount,
    platformFee,
    totalCharge,
    isDepositComplete: isDepositDataComplete(depositData),
    onPayCurrencyChange: setPayCurrency,
    onNetworkChange: setNetwork,
    onAmountChange: handleAmountChange,
    onQuickAmount: handleQuickAmount,
    onCreateDeposit: handleCreateDeposit,
    onCopyAddress: handleCopyAddress,
    onCancelDeposit: handleCancelDeposit,
    onResetToStep1: handleResetToStep1,
  };
}
