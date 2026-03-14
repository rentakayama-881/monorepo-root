import { useCallback, useState } from "react";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { generateIdempotencyKey } from "./accountUtils";

export function useAccountGuarantee({ featureBase, authed, setError, setOk }) {
  const [walletBalance, setWalletBalance] = useState(null);
  const [guaranteeAmount, setGuaranteeAmount] = useState(0);
  const [guaranteeLoading, setGuaranteeLoading] = useState(false);
  const [setGuaranteeAmountInput, setSetGuaranteeAmountInput] = useState("");
  const [setGuaranteePin, setSetGuaranteePin] = useState("");
  const [releaseGuaranteePin, setReleaseGuaranteePin] = useState("");
  const [guaranteeSubmitting, setGuaranteeSubmitting] = useState(false);
  const [guaranteeReleasing, setGuaranteeReleasing] = useState(false);

  const populate = useCallback((walletData, guaranteeData) => {
    if (walletData) {
      setWalletBalance(typeof walletData?.balance === "number" ? walletData.balance : 0);
    }
    if (guaranteeData) {
      setGuaranteeAmount(typeof guaranteeData?.amount === "number" ? guaranteeData.amount : 0);
    }
  }, []);

  async function loadWalletAndGuarantee() {
    if (!authed) return;

    setGuaranteeLoading(true);
    try {
      const [walletResult, guaranteeResult] = await Promise.allSettled([
        fetchWithAuth(`${featureBase}/api/v1/wallets/me`).then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        }),
        fetchWithAuth(`${featureBase}/api/v1/guarantees/me`).then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        }),
      ]);

      if (walletResult.status === "fulfilled" && walletResult.value) {
        setWalletBalance(
          typeof walletResult.value?.balance === "number" ? walletResult.value.balance : 0
        );
      }
      if (guaranteeResult.status === "fulfilled" && guaranteeResult.value) {
        setGuaranteeAmount(
          typeof guaranteeResult.value?.amount === "number" ? guaranteeResult.value.amount : 0
        );
      }
    } catch {
      // Ignore feature-service errors on account page.
    } finally {
      setGuaranteeLoading(false);
    }
  }

  async function submitSetGuarantee(event) {
    event.preventDefault();
    setError("");
    setOk("");
    setGuaranteeSubmitting(true);

    try {
      const amount = Number(setGuaranteeAmountInput);
      if (!Number.isFinite(amount)) throw new Error("Jumlah jaminan tidak valid");
      if (amount < 100000) throw new Error("Minimal jaminan adalah Rp 100.000");
      if (walletBalance != null && amount > walletBalance) throw new Error("Saldo tidak mencukupi");
      if (!setGuaranteePin || String(setGuaranteePin).length !== 6)
        throw new Error("PIN harus 6 digit");

      const response = await fetchWithAuth(`${featureBase}/api/v1/guarantees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount, pin: setGuaranteePin }),
      });

      const rawText = await response.text();
      if (!response.ok) {
        let message = rawText;
        try {
          const parsed = JSON.parse(rawText);
          message = parsed?.error?.message || parsed?.message || parsed?.error || rawText;
        } catch {
          // Keep raw text.
        }
        throw new Error(message || "Gagal mengunci jaminan");
      }

      let payload = {};
      try {
        payload = JSON.parse(rawText);
      } catch {
        // Keep fallback amount.
      }

      setGuaranteeAmount(typeof payload?.amount === "number" ? payload.amount : amount);
      setOk("Jaminan berhasil dikunci.");
      setSetGuaranteeAmountInput("");
      setSetGuaranteePin("");
      await loadWalletAndGuarantee();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuaranteeSubmitting(false);
    }
  }

  async function submitReleaseGuarantee(event) {
    event.preventDefault();
    setError("");
    setOk("");
    setGuaranteeReleasing(true);

    try {
      if (!releaseGuaranteePin || String(releaseGuaranteePin).length !== 6) {
        throw new Error("PIN harus 6 digit");
      }

      const response = await fetchWithAuth(`${featureBase}/api/v1/guarantees/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ pin: releaseGuaranteePin }),
      });

      const rawText = await response.text();
      if (!response.ok) {
        let message = rawText;
        try {
          const parsed = JSON.parse(rawText);
          message = parsed?.error?.message || parsed?.message || parsed?.error || rawText;
        } catch {
          // Keep raw text.
        }
        throw new Error(message || "Gagal melepaskan jaminan");
      }

      setGuaranteeAmount(0);
      setOk("Jaminan berhasil dilepaskan.");
      setReleaseGuaranteePin("");
      await loadWalletAndGuarantee();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuaranteeReleasing(false);
    }
  }

  return {
    walletBalance,
    guaranteeAmount,
    guaranteeLoading,
    setGuaranteeAmountInput,
    setSetGuaranteeAmountInput,
    setGuaranteePin,
    setSetGuaranteePin,
    releaseGuaranteePin,
    setReleaseGuaranteePin,
    guaranteeSubmitting,
    guaranteeReleasing,
    submitSetGuarantee,
    submitReleaseGuarantee,
    populate,
  };
}
