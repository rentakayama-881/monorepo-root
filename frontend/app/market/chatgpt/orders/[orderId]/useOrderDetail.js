import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";

const FINAL_STATUSES = new Set(["fulfilled", "failed"]);

function getStatusText(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "fulfilled") return "Selesai";
  if (normalized === "failed") return "Gagal";
  return "Diproses";
}

function getCurrentStep(order) {
  const steps = Array.isArray(order?.steps) ? order.steps : [];
  if (steps.length === 0) return null;
  return steps[steps.length - 1];
}

export function normalizeSubscription(order) {
  const raw = String(order?.delivery?.account?.subscription || order?.title || "").trim();
  if (!raw) return "-";
  return raw.replace(/plan$/i, "");
}

export function normalizeFailure(message) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("context canceled")
  ) {
    return "Permintaan melebihi batas waktu. Silakan coba lagi.";
  }
  if (
    lower.includes("saldo kamu tidak mencukupi") ||
    lower.includes("saldo wallet anda tidak mencukupi") ||
    lower.includes("insufficient")
  ) {
    return "Saldo wallet Anda belum mencukupi.";
  }
  // Backend returns specific Indonesian messages — pass through.
  if (raw && lower.startsWith("akun ")) {
    return raw;
  }
  if (lower.includes("checker") || lower.includes("retry_request")) {
    return "Sistem verifikasi sedang sibuk. Silakan coba lagi dalam beberapa saat.";
  }
  if (lower.includes("layanan") || lower.includes("kendala")) {
    return raw;
  }
  return "Terjadi kendala sementara pada proses pembelian.";
}

export function getStepLabel(step) {
  const code = String(step?.code || "").toUpperCase();
  const map = {
    INIT: "Pesanan dibuat",
    PROCESSING: "Memulai proses pembelian",
    USER_BALANCE_CHECK: "Memeriksa saldo wallet",
    USER_BALANCE_RESERVE: "Mengunci saldo pembayaran",
    PURCHASE_WORKFLOW: "Menjalankan alur pembelian otomatis",
    PLATFORM_READINESS_CHECK: "Memverifikasi kesiapan sistem penjualan",
    PLATFORM_READINESS_DEFERRED: "Melanjutkan proses pada verifikasi lanjutan",
    ITEM_AVAILABILITY_CHECK: "Memverifikasi ketersediaan akun",
    PURCHASE_EXECUTION: "Menjalankan pembelian",
    USER_BALANCE_CAPTURE: "Menyelesaikan pembayaran",
    DELIVERY_READY: "Data akun siap diberikan",

    // Backward compatibility for older orders.
    PROVIDER_DIRECT_BUY_FLOW: "Menjalankan alur pembelian otomatis",
    SUPPLIER_BALANCE_CHECK: "Memverifikasi kesiapan sistem penjualan",
    SUPPLIER_BALANCE_UNKNOWN_CONTINUE: "Melanjutkan proses pada verifikasi lanjutan",
    FETCH_PROVIDER_ITEM: "Memverifikasi ketersediaan akun",
    PROVIDER_PURCHASE: "Menjalankan pembelian",
  };
  return map[code] || step?.label || "Memproses";
}

export default function useOrderDetail() {
  const params = useParams();
  const orderID = String(params?.orderId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let timer = null;
    let lastKnownStatus = "";

    const scheduleRetry = (delayMs = 1800) => {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadOrder(false), delayMs);
    };

    async function loadOrder(isFirst = false) {
      if (!orderID) return;
      if (isFirst) {
        setLoading(true);
      }
      try {
        const data = await fetchJsonAuth(
          `/api/market/chatgpt/orders/${encodeURIComponent(orderID)}`,
          {
            method: "GET",
            timeout: 20000,
            cache: "no-store",
          }
        );
        if (!active) return;
        setError("");

        const nextOrder = data?.order || null;
        setOrder(nextOrder);

        const status = String(nextOrder?.status || "").toLowerCase();
        lastKnownStatus = status;

        if (nextOrder && !FINAL_STATUSES.has(status)) {
          setProgressModalOpen(true);
          scheduleRetry(1800);
        }

        if (status === "failed") {
          setProgressModalOpen(true);
        }
        if (status === "fulfilled") {
          setProgressModalOpen(false);
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Gagal memuat detail pembelian.");
        if (!FINAL_STATUSES.has(lastKnownStatus)) {
          scheduleRetry(3000);
        }
      } finally {
        if (active && isFirst) {
          setLoading(false);
          setManualRefresh(false);
        }
      }
    }

    loadOrder(true);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderID, refreshNonce]);

  const statusText = useMemo(() => getStatusText(order?.status), [order?.status]);
  const currentStep = useMemo(() => getCurrentStep(order), [order]);
  const statusNormalized = String(order?.status || "").toLowerCase();
  const isProcessing = order ? !FINAL_STATUSES.has(statusNormalized) : false;

  const handleRefresh = () => {
    setManualRefresh(true);
    setRefreshNonce((v) => v + 1);
  };

  return {
    loading,
    error,
    order,
    manualRefresh,
    progressModalOpen,
    setProgressModalOpen,
    statusText,
    currentStep,
    statusNormalized,
    isProcessing,
    handleRefresh,
  };
}
