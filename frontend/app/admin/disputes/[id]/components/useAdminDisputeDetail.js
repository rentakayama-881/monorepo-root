import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import logger from "@/lib/logger";
import { getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";
import { normalizeStatus } from "./disputeHelpers";

const API_BASE = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";

// ---------------------------------------------------------------------------
// Normalizer helpers (private to this module)
// ---------------------------------------------------------------------------

function normalizeResolution(payload) {
  if (!payload) return null;
  return {
    type: payload?.type ?? payload?.Type ?? "",
    refundToSender: Number(payload?.refundToSender ?? payload?.RefundToSender ?? 0) || 0,
    releaseToReceiver: Number(payload?.releaseToReceiver ?? payload?.ReleaseToReceiver ?? 0) || 0,
    note: payload?.note ?? payload?.Note ?? "",
  };
}

function normalizeDisputeMessage(message) {
  return {
    id: message?.id ?? message?.Id ?? "",
    senderUsername: message?.senderUsername ?? message?.SenderUsername ?? "User",
    isAdmin: Boolean(message?.isAdmin ?? message?.IsAdmin ?? false),
    content: message?.content ?? message?.Content ?? message?.message ?? "",
    sentAt:
      message?.sentAt ??
      message?.SentAt ??
      message?.createdAt ??
      message?.CreatedAt ??
      message?.sent_at ??
      null,
  };
}

function normalizeDisputeEvidence(evidence) {
  const typeRaw = evidence?.type ?? evidence?.Type ?? "other";
  return {
    id: evidence?.id ?? evidence?.Id ?? "",
    url: evidence?.url ?? evidence?.Url ?? evidence?.fileUrl ?? evidence?.FileUrl ?? "",
    type: String(typeRaw).toLowerCase(),
    description: evidence?.description ?? evidence?.Description ?? "",
    uploadedAt:
      evidence?.uploadedAt ??
      evidence?.UploadedAt ??
      evidence?.createdAt ??
      evidence?.CreatedAt ??
      null,
  };
}

function normalizeDispute(payload) {
  const data = unwrapFeatureData(payload) || {};
  const senderUsername =
    data?.senderUsername ??
    data?.SenderUsername ??
    data?.initiatorUsername ??
    data?.InitiatorUsername ??
    "Unknown";
  const receiverUsername =
    data?.receiverUsername ??
    data?.ReceiverUsername ??
    data?.respondentUsername ??
    data?.RespondentUsername ??
    "Unknown";

  return {
    id: data?.id ?? data?.Id ?? "",
    status: data?.status ?? data?.Status ?? "Open",
    category: data?.category ?? data?.Category ?? "Other",
    reason: data?.reason ?? data?.Reason ?? "",
    amount: Number(data?.amount ?? data?.Amount ?? 0) || 0,
    createdAt: data?.createdAt ?? data?.CreatedAt ?? null,
    senderUsername,
    receiverUsername,
    initiatorUsername: data?.initiatorUsername ?? data?.InitiatorUsername ?? senderUsername,
    respondentUsername: data?.respondentUsername ?? data?.RespondentUsername ?? receiverUsername,
    resolution: normalizeResolution(data?.resolution ?? data?.Resolution ?? null),
    messages: extractFeatureItems(data?.messages ?? data?.Messages).map(normalizeDisputeMessage),
    evidence: extractFeatureItems(data?.evidence ?? data?.Evidence).map(normalizeDisputeEvidence),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useAdminDisputeDetail() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesContainerRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const lastMessageSignatureRef = useRef("");

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionNote, setActionNote] = useState("");

  // ----- fetch helper -----

  const fetchWithAuth = useCallback(async (endpoint, options = {}) => {
    const token = getAdminToken();
    if (!token) {
      throw new Error("Sesi admin berakhir. Silakan login ulang.");
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || data.message || "Request failed");
    }
    if (res.status === 204) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    return res.json().catch(() => null);
  }, []);

  // ----- scroll helpers -----

  const getLastMessageSignature = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return "";
    const lastMessage = messages[messages.length - 1];
    return `${lastMessage?.id ?? ""}-${lastMessage?.sentAt ?? ""}-${messages.length}`;
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= 96;
  };

  // Scroll only within chat panel so page layout stays stable.
  const scrollToBottom = (behavior = "auto") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const handleMessagesScroll = () => {
    autoScrollEnabledRef.current = isNearBottom();
  };

  // ----- load dispute (callable from handlers) -----

  const loadDispute = useCallback(async () => {
    try {
      const data = await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}`);
      setDispute(normalizeDispute(data));
      setError("");
    } catch (e) {
      logger.error("Failed to load dispute:", e);
      setError("Dispute tidak ditemukan");
    }
  }, [disputeId, fetchWithAuth]);

  // ----- effects -----

  // Load dispute + polling
  useEffect(() => {
    if (!getAdminToken()) {
      router.push("/admin/login");
      return;
    }

    let cancelled = false;
    const fetchDispute = async () => {
      try {
        const data = await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}`);
        if (!cancelled) {
          setDispute(normalizeDispute(data));
          setError("");
        }
      } catch (e) {
        logger.error("Failed to load dispute:", e);
        if (!cancelled) setError("Dispute tidak ditemukan");
      }
      if (!cancelled) setLoading(false);
    };

    fetchDispute();
    const interval = setInterval(fetchDispute, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [disputeId, router, fetchWithAuth]);

  // Auto-scroll on new messages
  useEffect(() => {
    const messages = dispute?.messages ?? [];
    const signature = getLastMessageSignature(messages);

    if (!signature) {
      lastMessageSignatureRef.current = "";
      return;
    }

    const isInitialBatch = !lastMessageSignatureRef.current;
    const hasNewMessages = signature !== lastMessageSignatureRef.current;

    if (!hasNewMessages) {
      return;
    }

    lastMessageSignatureRef.current = signature;

    if (isInitialBatch || autoScrollEnabledRef.current) {
      scrollToBottom(isInitialBatch ? "auto" : "smooth");
    }
  }, [dispute?.messages]);

  // ----- handlers -----

  // Send admin message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError("");
    autoScrollEnabledRef.current = true;

    try {
      await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message.trim() }),
      });
      setMessage("");
      await loadDispute();
    } catch (e) {
      logger.error("Failed to send message:", e);
      setError("Gagal mengirim pesan");
    }
    setSending(false);
  };

  // Handle action click
  const handleAction = (action) => {
    setPendingAction(action);
    setActionNote("");
    setShowConfirmModal(true);
  };

  // Confirm action
  const confirmAction = async () => {
    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = `/api/v1/admin/disputes/${disputeId}/${pendingAction}`;
      await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({ note: actionNote }),
      });

      setShowConfirmModal(false);
      setSuccess(
        pendingAction === "refund"
          ? "Dana berhasil dikembalikan ke pembeli"
          : pendingAction === "force-release"
            ? "Dana berhasil dilepaskan ke penjual"
            : "Transaksi dilanjutkan mengikuti hold time"
      );
      await loadDispute();
    } catch (e) {
      logger.error("Action failed:", e);
      setError(e.message || "Gagal memproses aksi");
    }
    setProcessing(false);
  };

  // Update status
  const handleStatusUpdate = async (newStatus) => {
    try {
      await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadDispute();
    } catch (e) {
      logger.error("Status update failed:", e);
      setError("Gagal mengubah status");
    }
  };

  const isClosed = dispute
    ? ["resolved", "cancelled"].includes(normalizeStatus(dispute.status))
    : false;

  return {
    disputeId,
    dispute,
    loading,
    error,
    success,
    message,
    setMessage,
    sending,
    processing,
    showConfirmModal,
    setShowConfirmModal,
    pendingAction,
    actionNote,
    setActionNote,
    isClosed,
    messagesContainerRef,
    handleMessagesScroll,
    handleSendMessage,
    handleAction,
    confirmAction,
    handleStatusUpdate,
  };
}
