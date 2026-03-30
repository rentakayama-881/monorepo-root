"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import useAdminDisputeDetail from "./components/useAdminDisputeDetail";
import { getStatusColor, getStatusLabel } from "./components/disputeHelpers";
import DisputeInfoCard from "./components/DisputeInfoCard";
import StatusUpdateCard from "./components/StatusUpdateCard";
import AdminActionsCard from "./components/AdminActionsCard";
import ResolutionCard from "./components/ResolutionCard";
import MediationChat from "./components/MediationChat";
import EvidenceSection from "./components/EvidenceSection";
import ConfirmActionModal from "./components/ConfirmActionModal";

export default function AdminDisputeDetailPage() {
  const {
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
  } = useAdminDisputeDetail();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Sengketa Tidak Ditemukan</h1>
          <Link href="/admin/disputes" className="text-primary hover:underline">
            ← Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/disputes"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Daftar Sengketa
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Sengketa #{disputeId?.slice(-6)}
          </h1>
          <span
            className={`inline-flex items-center rounded-sm border px-3 py-1 text-xs font-medium ${getStatusColor(dispute.status)}`}
          >
            {getStatusLabel(dispute.status)}
          </span>
        </div>
      </div>

      {success && (
        <div className="mb-6 rounded-lg border border-success/30 bg-success/10 p-4 text-success">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left: Dispute Info & Actions */}
        <div className="xl:col-span-1 space-y-6">
          <DisputeInfoCard dispute={dispute} />

          {!isClosed && <StatusUpdateCard dispute={dispute} onStatusUpdate={handleStatusUpdate} />}

          {!isClosed && <AdminActionsCard onAction={handleAction} />}

          {dispute.resolution && <ResolutionCard resolution={dispute.resolution} />}
        </div>

        {/* Right: Chat */}
        <div className="xl:col-span-2">
          <MediationChat
            dispute={dispute}
            isClosed={isClosed}
            message={message}
            sending={sending}
            messagesContainerRef={messagesContainerRef}
            onMessagesScroll={handleMessagesScroll}
            onMessageChange={setMessage}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      <EvidenceSection evidence={dispute.evidence} />

      {showConfirmModal && (
        <ConfirmActionModal
          pendingAction={pendingAction}
          actionNote={actionNote}
          processing={processing}
          dispute={dispute}
          onActionNoteChange={setActionNote}
          onConfirm={confirmAction}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
}
