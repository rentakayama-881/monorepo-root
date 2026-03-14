"use client";
import Link from "next/link";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { PageLoadingBlock } from "@/components/ui/LoadingState";
import useTransactionDetail from "./components/useTransactionDetail";
import TransactionHeader from "./components/TransactionHeader";
import EscrowNotice from "./components/EscrowNotice";
import TransactionActions from "./components/TransactionActions";
import PinModal from "./components/PinModal";
import DisputeModal from "./components/DisputeModal";
import NoPinModal from "./components/NoPinModal";

export default function TransactionDetailPage() {
  const {
    transfer,
    loading,
    processing,
    error,
    actionSuccess,
    pin,
    pendingAction,
    disputeCategory,
    disputeReason,
    showPinModal,
    showConfirmModal,
    showNoPinModal,
    isSender,
    isReceiver,
    status,
    holdInfo,
    setPin,
    setError,
    setDisputeCategory,
    setDisputeReason,
    setShowPinModal,
    setShowConfirmModal,
    setShowNoPinModal,
    handleAction,
    confirmActionWithPin,
    confirmActionWithoutPin,
  } = useTransactionDetail();

  if (loading) {
    return (
      <PageLoadingBlock
        className="min-h-screen bg-background"
        maxWidthClass="max-w-2xl"
        lines={4}
      />
    );
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/account/wallet/transactions"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="rounded-lg border border-border bg-card">
          <TransactionHeader
            transfer={transfer}
            isSender={isSender}
            status={status}
            holdInfo={holdInfo}
          />

          {/* Status Explanation for Held */}
          {status === "held" && holdInfo && (
            <EscrowNotice isSender={isSender} holdInfo={holdInfo} />
          )}

          {/* Success Message */}
          {actionSuccess && (
            <div className="mx-6 mb-6 rounded-lg bg-success/10 border border-success/30 p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{actionSuccess}</span>
              </div>
            </div>
          )}

          <TransactionActions
            isSender={isSender}
            isReceiver={isReceiver}
            status={status}
            transfer={transfer}
            onAction={handleAction}
          />
        </div>
      </div>

      {/* PIN Modal for release/cancel */}
      {showPinModal && (
        <PinModal
          pendingAction={pendingAction}
          pin={pin}
          error={error}
          processing={processing}
          onPinChange={setPin}
          onConfirm={confirmActionWithPin}
          onClose={() => {
            setShowPinModal(false);
            setError("");
          }}
        />
      )}

      {/* Confirm Modal for dispute (no PIN required) */}
      {showConfirmModal && (
        <DisputeModal
          disputeCategory={disputeCategory}
          disputeReason={disputeReason}
          error={error}
          processing={processing}
          onCategoryChange={setDisputeCategory}
          onReasonChange={setDisputeReason}
          onConfirm={confirmActionWithoutPin}
          onClose={() => {
            setShowConfirmModal(false);
            setError("");
          }}
        />
      )}

      {/* No PIN Setup Modal */}
      {showNoPinModal && <NoPinModal onClose={() => setShowNoPinModal(false)} />}
    </div>
  );
}
