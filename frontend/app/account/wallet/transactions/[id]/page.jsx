"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
} from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import logger from "@/lib/logger";
import { PageLoadingBlock } from "@/components/ui/LoadingState";

// Dispute categories matching backend
const DISPUTE_CATEGORIES = [
  { value: "ItemNotReceived", label: "Item/Service Not Received" },
  { value: "ItemNotAsDescribed", label: "Item/Service Not as Described" },
  { value: "Fraud", label: "Suspected Fraud" },
  { value: "SellerNotResponding", label: "Seller Not Responding" },
  { value: "Other", label: "Other Reason" },
];

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

export default function TransactionDetailPage() {
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
        category: disputeCategory
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

  // Normalize backend status to frontend expected status
  const normalizeStatus = (status) => {
    const statusMap = {
      "Pending": "held",
      "Released": "released",
      "Cancelled": "cancelled",
      "Rejected": "rejected",
      "Disputed": "disputed",
      "Expired": "released",
    };
    return statusMap[status] || status?.toLowerCase() || "held";
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeStatus(status);
    const styles = {
      held: "bg-warning/10 text-warning border-warning/30",
      released: "bg-success/10 text-success border-success/30",
      refunded: "bg-primary/10 text-primary border-primary/30",
      disputed: "bg-destructive/10 text-destructive border-destructive/30",
      cancelled: "bg-muted/60 text-muted-foreground border-border",
      rejected: "bg-destructive/10 text-destructive border-destructive/30",
    };
    const labels = {
      held: "Funds on Hold",
      released: "Completed",
      refunded: "Refunded",
      disputed: "In Mediation",
      cancelled: "Cancelled",
      rejected: "Rejected by Recipient",
    };
    return (
      <span className={`rounded-full border px-3 py-1 text-sm font-medium ${styles[normalized] || styles.held}`}>
        {labels[normalized] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return <PageLoadingBlock className="min-h-screen bg-background" maxWidthClass="max-w-2xl" lines={4} />;
  }

  if (!transfer) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center">
          <div className="text-destructive mb-4">{error || "Transfer not found"}</div>
          <Link href="/account/wallet/transactions" className="text-primary hover:underline">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  // Use Number() conversion for safe comparison (handle string/number type mismatch)
  const isSender = Number(currentUser?.id) === Number(transfer.senderId);
  const isReceiver = Number(currentUser?.id) === Number(transfer.receiverId);
  const status = normalizeStatus(transfer.status);
  
  // Calculate hold period info
  const getHoldInfo = () => {
    if (!transfer.holdUntil) return null;
    const holdUntil = new Date(transfer.holdUntil);
    const createdAt = new Date(transfer.createdAt);
    const now = new Date();
    const daysRemaining = Math.ceil((holdUntil - now) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((holdUntil - createdAt) / (1000 * 60 * 60 * 24));
    return { daysRemaining: Math.max(0, daysRemaining), totalDays, holdUntil };
  };
  const holdInfo = getHoldInfo();

  return (
    <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link
            href="/account/wallet/transactions"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>

          <div className="rounded-lg border border-border bg-card">
            {/* Header */}
            <div className="border-b border-border p-6 text-center">
              <div className="text-sm text-muted-foreground mb-1">
                {isSender ? "You sent to" : "You received from"}
                <span className="font-medium text-foreground ml-1">
                  @{isSender ? transfer.receiverUsername : transfer.senderUsername}
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground mb-3">
                Rp {transfer.amount?.toLocaleString("id-ID") || 0}
              </div>
              {getStatusBadge(transfer.status)}
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Sender</span>
                <span className="font-medium text-foreground">
                  @{transfer.senderUsername || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-medium text-foreground">
                  @{transfer.receiverUsername || "Unknown"}
                </span>
              </div>
              {transfer.message && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Note</span>
                  <span className="font-medium text-foreground text-right max-w-xs">
                    {transfer.message}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Transfer Code</span>
                <span className="font-mono text-foreground">
                  {transfer.code}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Created Date</span>
                <span className="font-medium text-foreground">
                  {formatDate(transfer.createdAt)}
                </span>
              </div>
              {status === "held" && holdInfo && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Auto Release</span>
                  <span className="font-medium text-foreground">
                    {formatDate(transfer.holdUntil)}
                  </span>
                </div>
              )}
              {transfer.releasedAt && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Completed Date</span>
                  <span className="font-medium text-primary">
                    {formatDate(transfer.releasedAt)}
                  </span>
                </div>
              )}
              {transfer.cancelledAt && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Cancelled Date</span>
                  <span className="font-medium text-destructive">
                    {formatDate(transfer.cancelledAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Status Explanation for Held */}
            {status === "held" && holdInfo && (
              <div className="mx-6 mb-6 rounded-lg bg-warning/10 border border-warning/30 p-4">
                <div className="flex gap-3">
                  <svg className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-warning mb-1">Funds Under Escrow Protection</div>
                    <div className="text-sm text-muted-foreground">
                      {isSender ? (
                        <>
                          Your funds are temporarily held to protect the transaction.
                          {holdInfo.daysRemaining > 0 
                            ? ` Funds will be automatically released to the recipient in ${holdInfo.daysRemaining} days.`
                            : " Funds will be released to the recipient shortly."
                          }
                          <br /><br />
                          <strong>Received the item/service?</strong> You can release funds early.
                          <br />
                          <strong>Need help?</strong> You can cancel the transaction or request support from our team.
                        </>
                      ) : (
                        <>
                          Funds are currently held in escrow to protect both parties.
                          {holdInfo.daysRemaining > 0 
                            ? ` Funds will be added to your balance automatically in ${holdInfo.daysRemaining} days.`
                            : " Funds will be added to your balance shortly."
                          }
                          <br /><br />
                          <strong>Encountering an issue?</strong> You can request support from our mediation team.
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {actionSuccess && (
              <div className="mx-6 mb-6 rounded-lg bg-success/10 border border-success/30 p-4">
                <div className="flex items-center gap-2 text-success">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{actionSuccess}</span>
                </div>
              </div>
            )}

            {/* Actions for held transfers */}
            {status === "held" && (
              <div className="p-6 border-t border-border space-y-3">
                {isSender && (
                  <>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm text-muted-foreground">
                      <p className="mb-2">
                        <strong className="text-foreground">For Sender:</strong>
                      </p>
                      <p>
                        Received the item/service? You may release funds early.<br/>
                        Need help? You can request support from our mediation team.
                      </p>
                    </div>
                    <button
                      onClick={() => handleAction("release")}
                      className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      Release Funds Early
                    </button>
                  </>
                )}
                {isReceiver && (
                  <>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm text-muted-foreground">
                      <p className="mb-2">
                        <strong className="text-foreground">For Recipient:</strong>
                      </p>
                      <p>
                        As recipient, funds are automatically credited after the hold period ends.
                      </p>
                    </div>
                    <button
                      onClick={() => handleAction("reject")}
                      className="w-full rounded-lg border border-destructive/30 py-3 font-semibold text-destructive transition hover:bg-destructive/10"
                    >
                      Reject Transfer & Return to Sender
                    </button>
                  </>
                )}
                {/* Only sender can open dispute/mediation */}
                {isSender && (
                  <button
                    onClick={() => handleAction("dispute")}
                    className="w-full rounded-lg border border-primary/30 py-3 font-semibold text-primary transition hover:bg-primary/10"
                  >
                    Request Mediation Support
                  </button>
                )}
              </div>
            )}

            {/* Link to dispute if disputed */}
            {status === "disputed" && transfer.disputeId && (
              <div className="p-6 border-t border-border">
                <Link
                  href={`/account/wallet/disputes/${transfer.disputeId}`}
                  className="block w-full rounded-lg bg-primary/10 border border-primary/30 py-3 text-center font-semibold text-primary transition hover:opacity-80"
                >
                  View Mediation Details
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* PIN Modal for release/cancel */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-card p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Confirm with PIN
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {pendingAction === "release" && "Enter PIN to release funds to recipient"}
                {pendingAction === "cancel" && "Enter PIN to cancel and refund funds"}
                {pendingAction === "reject" && "Enter PIN to reject transfer and return funds to sender"}
              </p>

              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-primary"
              />

              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setShowPinModal(false); setError(""); }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmActionWithPin}
                  disabled={processing || pin.length !== 6}
                  className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Modal for dispute (no PIN required) */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="w-full max-w-md rounded-lg bg-card p-6 my-8">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Request Mediation Support
              </h3>
              <div className="text-sm text-muted-foreground mb-4">
                <p>
                  Describe the issue clearly so our team can assist effectively.
                </p>
              </div>

              {/* Category Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Issue Category <span className="text-destructive">*</span>
                </label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">-- Select Category --</option>
                  {DISPUTE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason Textarea */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Describe the Issue <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe the issue in detail (minimum 20 characters)..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-foreground focus:outline-none focus:border-primary resize-none"
                />
                <div className={`text-xs mt-1 ${disputeReason.length >= 20 ? 'text-success' : 'text-muted-foreground'}`}>
                  {disputeReason.length}/20 minimum characters {disputeReason.length >= 20 ? '✓' : ''}
                </div>
              </div>

              {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setError(""); }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmActionWithoutPin}
                  disabled={processing || !disputeCategory || disputeReason.length < 20}
                  className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No PIN Setup Modal */}
        {showNoPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-card p-6">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-warning/10 p-3">
                  <svg className="h-8 w-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 text-center">
                PIN Not Configured
              </h3>
              <div className="text-sm text-muted-foreground mb-6 text-center space-y-2">
                <p>
                  To perform this action, you must set up a security PIN first.
                </p>
                <p className="text-xs">
                  Please set up a PIN by following:
                </p>
                <ol className="text-xs text-left list-decimal list-inside space-y-1">
                  <li>Enable two-factor authentication (2FA) in account settings</li>
                  <li>Then click <strong>Send Funds</strong> or <strong>Withdraw Funds</strong> to configure your PIN</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNoPinModal(false)}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Close
                </button>
                <Link
                  href="/account?setup2fa=true"
                  className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground text-center transition hover:opacity-90"
                >
                  Security Settings
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
