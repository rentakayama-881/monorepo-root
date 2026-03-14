import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
  extractFeatureItems,
} from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

function normalizeCurrentUser(payload) {
  return {
    id: Number(payload?.id ?? payload?.user_id ?? payload?.userId ?? 0) || 0,
    username: payload?.username ?? payload?.Username ?? "",
  };
}

function normalizeResolution(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    const normalized = payload.toLowerCase();
    if (normalized === "refund") {
      return { type: "FullRefundToSender", refundToSender: 0, releaseToReceiver: 0, note: "" };
    }
    if (normalized === "release") {
      return { type: "FullReleaseToReceiver", refundToSender: 0, releaseToReceiver: 0, note: "" };
    }
    return { type: payload, refundToSender: 0, releaseToReceiver: 0, note: "" };
  }
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
    senderId: Number(message?.senderId ?? message?.SenderId ?? 0) || 0,
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
  return {
    id: data?.id ?? data?.Id ?? "",
    status: data?.status ?? data?.Status ?? "Open",
    category: data?.category ?? data?.Category ?? "Other",
    reason: data?.reason ?? data?.Reason ?? "",
    amount: Number(data?.amount ?? data?.Amount ?? 0) || 0,
    initiatorId: Number(data?.initiatorId ?? data?.InitiatorId ?? 0) || 0,
    respondentId: Number(data?.respondentId ?? data?.RespondentId ?? 0) || 0,
    initiatorUsername: data?.initiatorUsername ?? data?.InitiatorUsername ?? "Unknown",
    respondentUsername: data?.respondentUsername ?? data?.RespondentUsername ?? "Unknown",
    resolution: normalizeResolution(data?.resolution ?? data?.Resolution ?? null),
    messages: extractFeatureItems(data?.messages ?? data?.Messages).map(normalizeDisputeMessage),
    evidence: extractFeatureItems(data?.evidence ?? data?.Evidence).map(normalizeDisputeEvidence),
  };
}

export default function useDisputeDetail() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesContainerRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const lastMessageSignatureRef = useRef("");

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(0);

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

  // Scroll only inside the message container to prevent viewport jump.
  const scrollToBottom = (behavior = "auto") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMessagesScroll = () => {
    autoScrollEnabledRef.current = isNearBottom();
  };

  const fetchDisputeData = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.DETAIL(disputeId));
      setDispute(normalizeDispute(response));
    } catch (e) {
      logger.error("Failed to load dispute:", e);
      setError("Dispute not found or you do not have access.");
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let interval;

    async function initialize() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const user = normalizeCurrentUser(await fetchJsonAuth("/api/user/me"));
        if (isMounted) {
          setCurrentUserId(user.id);
        }
      } catch (e) {
        logger.error("Failed to load current user:", e);
      }

      await fetchDisputeData(true);

      interval = setInterval(() => {
        fetchDisputeData(false);
      }, 5000);
    }

    initialize();

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [router, disputeId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError("");
    autoScrollEnabledRef.current = true;

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.MESSAGES(disputeId), {
        method: "POST",
        body: JSON.stringify({ content: message.trim() }),
      });
      setMessage("");
      await fetchDisputeData(false);
    } catch (e) {
      logger.error("Failed to send message:", e);
      setError("Failed to send message.");
    }
    setSending(false);
  };

  const normalizeStatus = (status) =>
    String(status || "")
      .replace(/\s+/g, "")
      .toLowerCase();

  const isInitiator = Number(dispute?.initiatorId) === Number(currentUserId);
  const status = normalizeStatus(dispute?.status);
  const isClosed = status === "resolved" || status === "cancelled";

  return {
    disputeId,
    dispute,
    loading,
    sending,
    message,
    setMessage,
    error,
    currentUserId,
    isInitiator,
    isClosed,
    messagesContainerRef,
    handleMessagesScroll,
    handleSendMessage,
    normalizeStatus,
  };
}
