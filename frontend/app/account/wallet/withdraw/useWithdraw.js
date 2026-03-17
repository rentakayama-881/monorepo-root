import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";

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

export const quickAmounts = [10000, 50000, 100000, 200000, 500000, 1000000];
export const minWithdraw = 10000;
export const feePercent = 0.02;

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

export default function useWithdraw() {
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
  const availableNetworks = useMemo(() => selectedCrypto?.networks || [], [selectedCrypto]);

  const loadDataRef = useRef(false);

  useEffect(() => {
    if (loadDataRef.current) return;
    loadDataRef.current = true;
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
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
    loadData();
  }, [router]);

  useEffect(() => {
    setNetwork(availableNetworks.length === 1 ? availableNetworks[0] : "");
  }, [availableNetworks]);

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

  function goBack() {
    if (step > 1) {
      setStep(step - 1);
      setError("");
      if (step === 3) setPin("");
    } else {
      router.push("/account/wallet/transactions");
    }
  }

  function goNext() {
    setStep(step + 1);
    setError("");
  }

  const isStep1Valid =
    cryptoCurrency && cryptoAddress.length >= 10 && (availableNetworks.length <= 1 || network);
  const isStep2Valid = parsedAmount >= minWithdraw && totalDeduction <= wallet.balance;

  return {
    step,
    wallet,
    loading,
    processing,
    error,
    cryptoCurrency,
    setCryptoCurrency,
    network,
    setNetwork,
    cryptoAddress,
    setCryptoAddress,
    memo,
    setMemo,
    amount,
    pin,
    setPin,
    parsedAmount,
    fee,
    totalDeduction,
    availableNetworks,
    cryptoCurrencies: CRYPTO_CURRENCIES,
    isStep1Valid,
    isStep2Valid,
    handleAmountChange,
    handleQuickAmount,
    handleWithdraw,
    goBack,
    goNext,
  };
}
