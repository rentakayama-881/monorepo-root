import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
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

export function formatCurrency(value) {
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("id-ID");
}

export default function useSendTransfer() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState({ balance: 0, has_pin: false });

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
        const walletData = normalizeWallet(await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME));
        setWallet(walletData);

        if (!walletData.has_pin) {
          router.push("/account/wallet/set-pin?redirect=send");
        }
      } catch (e) {
        logger.error("Failed to load wallet:", e);
        if (e.code === "TWO_FACTOR_REQUIRED") {
          router.push(
            "/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/send")
          );
        }
      }
    }
    loadWallet();
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setSearching(true);
        try {
          const userData = normalizeSearchUser(
            await fetchFeatureAuth(
              FEATURE_ENDPOINTS.TRANSFERS.SEARCH_USER +
                `?username=${encodeURIComponent(searchQuery)}`
            )
          );
          if (userData && userData.exists) {
            setSearchResults([
              {
                id: userData.userId,
                username: userData.username,
                avatar_url: userData.avatarUrl,
              },
            ]);
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
      setError("Minimum transfer is IDR 10,000");
      return;
    }
    if (amountNum > wallet.balance) {
      setError("Insufficient balance");
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
          holdHours: holdDays * 24,
          message: description,
          pin,
        }),
      });

      router.push("/account/wallet/transactions?success=transfer");
    } catch (e) {
      logger.error("Transfer failed:", e);
      if (e.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          "/account/security?setup2fa=true&redirect=" + encodeURIComponent("/account/wallet/send")
        );
        return;
      }
      setError(getErrorMessage(e, "Unable to send funds."));
      setLoading(false);
    }
  };

  const handleChangeUser = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setStep(1);
  };

  return {
    step,
    setStep,
    loading,
    searching,
    error,
    wallet,
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedUser,
    amount,
    setAmount,
    holdDays,
    setHoldDays,
    description,
    setDescription,
    pin,
    setPin,
    handleSelectUser,
    handleAmountNext,
    handleSubmit,
    handleChangeUser,
  };
}
