import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";
import { normalizeCurrentUser, normalizeDispute } from "./normalizers";

export default function useWalletDisputeDetail() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesContainerRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const lastMessageSignatureRef = useRef("");

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");

  // Message form
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Evidence form
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const getLastMessageSignature = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return "";
    const lastMessage = messages[messages.length - 1];
    return `${lastMessage?.id ?? ""}-${lastMessage?.createdAt ?? ""}-${messages.length}`;
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= 96;
  };

  // Scroll only inside the message area to keep page position stable.
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

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch current user from API
      try {
        const userData = await fetchJsonAuth("/api/user/me");
        setCurrentUser(normalizeCurrentUser(userData));
      } catch (e) {
        logger.error("Failed to load user:", e);
      }

      try {
        const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.DETAIL(disputeId));
        setDispute(normalizeDispute(response));
      } catch (e) {
        logger.error("Failed to load dispute:", e);
        setError("Dispute not found");
      }
      setLoading(false);
    }

    loadData();
  }, [router, disputeId]);

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

  const refreshDispute = async () => {
    try {
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.DETAIL(disputeId));
      setDispute(normalizeDispute(response));
    } catch (e) {
      logger.error("Failed to refresh dispute:", e);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSendingMessage(true);
    autoScrollEnabledRef.current = true;

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.MESSAGES(disputeId), {
        method: "POST",
        body: JSON.stringify({ content: message.trim() }),
      });

      setMessage("");
      await refreshDispute();
    } catch (e) {
      logger.error("Failed to send message:", e);
    }
    setSendingMessage(false);
  };

  const addEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceDescription.trim()) return;

    setProcessing(true);

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.EVIDENCE(disputeId), {
        method: "POST",
        body: JSON.stringify({
          description: evidenceDescription.trim(),
          fileUrl: evidenceUrl.trim() || null,
        }),
      });

      setEvidenceDescription("");
      setEvidenceUrl("");
      setShowEvidenceForm(false);
      await refreshDispute();
    } catch (e) {
      logger.error("Failed to add evidence:", e);
    }
    setProcessing(false);
  };

  const handleMutualAction = async (action) => {
    setProcessing(true);

    try {
      const endpoint =
        action === "release"
          ? `/api/v1/disputes/${disputeId}/mutual-release`
          : `/api/v1/disputes/${disputeId}/mutual-refund`;

      await fetchFeatureAuth(endpoint, { method: "POST" });
      await refreshDispute();
    } catch (e) {
      setError(e.message || "An error occurred");
    }
    setProcessing(false);
  };

  // Derived values
  // Use senderId/receiverId from transfer, NOT initiatorId
  // This ensures logic is based on who SENT money, not who opened dispute
  const isSender =
    currentUser?.id === dispute?.senderId || currentUser?.username === dispute?.senderUsername;
  const isReceiver =
    currentUser?.id === dispute?.receiverId || currentUser?.username === dispute?.receiverUsername;
  const isOpen = dispute?.status?.toLowerCase() === "open";

  return {
    // State
    dispute,
    loading,
    processing,
    currentUser,
    error,

    // Message form
    message,
    setMessage,
    sendingMessage,

    // Evidence form
    showEvidenceForm,
    setShowEvidenceForm,
    evidenceDescription,
    setEvidenceDescription,
    evidenceUrl,
    setEvidenceUrl,

    // Refs
    messagesContainerRef,

    // Handlers
    onSendMessage: sendMessage,
    onAddEvidence: addEvidence,
    onMutualAction: handleMutualAction,
    handleMessagesScroll,

    // Derived
    isSender,
    isReceiver,
    isOpen,
  };
}
