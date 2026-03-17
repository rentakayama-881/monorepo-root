import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";

function normalizeWallet(payload) {
  const data = unwrapFeatureData(payload) || {};
  const pinSetRaw =
    data.pinSet ?? data.PinSet ?? data.pin_set ?? data.hasPin ?? data.has_pin ?? false;
  return {
    ...data,
    pinSet: Boolean(pinSetRaw),
  };
}

function normalizeTransfer(payload) {
  const data = unwrapFeatureData(payload) || {};
  return {
    ...data,
    id: data?.id ?? data?.Id ?? "",
    senderId: Number(data?.senderId ?? data?.SenderId ?? 0) || 0,
    receiverId: Number(data?.receiverId ?? data?.ReceiverId ?? 0) || 0,
    senderUsername: data?.senderUsername ?? data?.SenderUsername ?? "Unknown",
    receiverUsername: data?.receiverUsername ?? data?.ReceiverUsername ?? "Unknown",
    amount: Number(data?.amount ?? data?.Amount ?? 0) || 0,
    status: data?.status ?? data?.Status ?? "",
    createdAt: data?.createdAt ?? data?.CreatedAt ?? null,
    holdUntil: data?.holdUntil ?? data?.HoldUntil ?? null,
    releasedAt: data?.releasedAt ?? data?.ReleasedAt ?? null,
    cancelledAt: data?.cancelledAt ?? data?.CancelledAt ?? null,
    code: data?.code ?? data?.Code ?? "",
    message: data?.message ?? data?.Message ?? "",
  };
}

// Normalize backend status to frontend expected status
export function normalizeStatus(status) {
  const statusMap = {
    Pending: "held",
    Released: "released",
    Cancelled: "cancelled",
    Rejected: "rejected",
    Disputed: "disputed",
    Expired: "released",
  };
  return statusMap[status] || status?.toLowerCase() || "held";
}

export { formatDateTime as formatDate } from "@/lib/format";

export default function useTransactionDetail() {
  const router = useRouter();
  const params = useParams();
  const transferId = params.id;

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNoPinModal, setShowNoPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [disputeCategory, setDisputeCategory] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch current user from Go backend
      try {
        const userData = await fetchJsonAuth("/api/user/me");
        setCurrentUser(userData);
      } catch (e) {
        logger.error("Failed to load user:", e);
      }

      // Fetch wallet to check PIN status
      try {
        const walletData = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
        setWallet(normalizeWallet(walletData));
      } catch (e) {
        logger.error("Failed to load wallet:", e);
      }

      // Fetch transfer from Feature Service
      try {
        const transferData = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.DETAIL(transferId));
        setTransfer(normalizeTransfer(transferData));
      } catch (e) {
        logger.error("Failed to load transfer:", e);
        setError("Transfer not found");
      }
      setLoading(false);
    }

    loadData();
  }, [router, transferId]);

  // Check if user has PIN set
  const hasPinSet = Boolean(wallet?.pinSet);

  // Handle action - check PIN requirement
  const handleAction = (action) => {
    setPendingAction(action);
    setError("");
    setActionSuccess("");

    // Dispute doesn't require PIN but needs category and reason
    if (action === "dispute") {
      setDisputeCategory("");
      setDisputeReason("");
      setShowConfirmModal(true);
      return;
    }

    // Release and Cancel require PIN
    if (!hasPinSet) {
      setShowNoPinModal(true);
      return;
    }

    setShowPinModal(true);
    setPin("");
  };

  // Confirm action without PIN (dispute)
  const confirmActionWithoutPin = async () => {
    // Validate dispute form
    if (!disputeCategory) {
      setError("Select an issue category");
      return;
    }
    if (!disputeReason || disputeReason.length < 20) {
      setError("Please provide at least 20 characters.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const endpoint = FEATURE_ENDPOINTS.DISPUTES.CREATE;
      const body = {
        transferId: transferId,
        reason: disputeReason,
        category: disputeCategory,
      };

      const result = await fetchFeatureAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setShowConfirmModal(false);

      // Redirect to dispute center
      const disputeData = unwrapFeatureData(result) || {};
      if (disputeData?.disputeId) {
        router.push(`/account/wallet/disputes/${disputeData.disputeId}`);
      } else {
        setActionSuccess("Mediation request submitted successfully. Our team will contact you.");
        // Reload transfer
        const transferData = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.DETAIL(transferId));
        setTransfer(normalizeTransfer(transferData));
      }
    } catch (e) {
      logger.error("Dispute action failed:", e);
      setError(getErrorMessage(e, "Unable to submit mediation request."));
    }
    setProcessing(false);
  };

  // Confirm action with PIN (release/cancel)
  const confirmActionWithPin = async () => {
    if (pin.length !== 6) {
      setError("PIN must be 6 digits.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      let endpoint = "";
      let body = { pin };

      if (pendingAction === "release") {
        endpoint = FEATURE_ENDPOINTS.TRANSFERS.RELEASE(transferId);
      } else if (pendingAction === "cancel") {
        endpoint = FEATURE_ENDPOINTS.TRANSFERS.CANCEL(transferId);
        body.reason = "Cancelled by sender";
      } else if (pendingAction === "reject") {
        endpoint = FEATURE_ENDPOINTS.TRANSFERS.REJECT(transferId);
        body.reason = "Rejected by recipient";
      }

      await fetchFeatureAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setShowPinModal(false);
      setActionSuccess(
        pendingAction === "release"
          ? "Funds released to recipient successfully!"
          : pendingAction === "reject"
            ? "Transfer rejected, funds returned to sender."
            : "Transaction cancelled successfully, funds returned."
      );

      // Reload transfer
      const transferData = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.DETAIL(transferId));
      setTransfer(normalizeTransfer(transferData));
    } catch (e) {
      logger.error("Action failed:", e);
      setError(getErrorMessage(e, "Unable to process request. Please ensure your PIN is correct."));
    }
    setProcessing(false);
  };

  // Computed values (safe even when transfer is null)
  // Use Number() conversion for safe comparison (handle string/number type mismatch)
  const isSender = transfer ? Number(currentUser?.id) === Number(transfer.senderId) : false;
  const isReceiver = transfer ? Number(currentUser?.id) === Number(transfer.receiverId) : false;
  const status = transfer ? normalizeStatus(transfer.status) : null;

  // Calculate hold period info
  const holdInfo = (() => {
    if (!transfer?.holdUntil) return null;
    const holdUntil = new Date(transfer.holdUntil);
    const createdAt = new Date(transfer.createdAt);
    const now = new Date();
    const daysRemaining = Math.ceil((holdUntil - now) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((holdUntil - createdAt) / (1000 * 60 * 60 * 24));
    return { daysRemaining: Math.max(0, daysRemaining), totalDays, holdUntil };
  })();

  return {
    // Data
    transfer,
    loading,
    processing,
    error,
    actionSuccess,
    pin,
    pendingAction,
    disputeCategory,
    disputeReason,

    // Modal visibility
    showPinModal,
    showConfirmModal,
    showNoPinModal,

    // Computed
    isSender,
    isReceiver,
    status,
    holdInfo,

    // Setters
    setPin,
    setError,
    setDisputeCategory,
    setDisputeReason,
    setShowPinModal,
    setShowConfirmModal,
    setShowNoPinModal,

    // Handlers
    handleAction,
    confirmActionWithPin,
    confirmActionWithoutPin,
  };
}
