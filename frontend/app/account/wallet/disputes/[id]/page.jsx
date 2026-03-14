"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageLoadingBlock } from "@/components/ui/LoadingState";
import useWalletDisputeDetail from "./components/useWalletDisputeDetail";
import PhaseInfoBanner from "./components/PhaseInfoBanner";
import DisputeMessages from "./components/DisputeMessages";
import EvidenceSection from "./components/EvidenceSection";
import TransferDetails from "./components/TransferDetails";
import DisputeActions from "./components/DisputeActions";
import ResolutionResult from "./components/ResolutionResult";

export default function DisputeDetailPage() {
  const {
    dispute,
    loading,
    processing,
    currentUser,
    error,
    message,
    setMessage,
    sendingMessage,
    showEvidenceForm,
    setShowEvidenceForm,
    evidenceDescription,
    setEvidenceDescription,
    evidenceUrl,
    setEvidenceUrl,
    messagesContainerRef,
    onSendMessage,
    onAddEvidence,
    onMutualAction,
    handleMessagesScroll,
    isSender,
    isReceiver,
    isOpen,
  } = useWalletDisputeDetail();

  if (loading) {
    return (
      <PageLoadingBlock
        className="min-h-screen bg-background"
        maxWidthClass="max-w-3xl"
        lines={4}
      />
    );
  }

  if (!dispute) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="text-destructive mb-4">{error || "Dispute not found"}</div>
          <Link href="/account/wallet/disputes" className="text-primary hover:underline">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/account/wallet/disputes"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <PhaseInfoBanner
              phase={dispute.phase}
              phaseDeadline={dispute.phaseDeadline}
              isOpen={isOpen}
            />

            <DisputeMessages
              messages={dispute.messages}
              currentUser={currentUser}
              isOpen={isOpen}
              messagesContainerRef={messagesContainerRef}
              onScroll={handleMessagesScroll}
              message={message}
              onMessageChange={setMessage}
              onSendMessage={onSendMessage}
              sendingMessage={sendingMessage}
            />

            <EvidenceSection
              evidence={dispute.evidence}
              phase={dispute.phase}
              isOpen={isOpen}
              showForm={showEvidenceForm}
              onToggleForm={() => setShowEvidenceForm(!showEvidenceForm)}
              evidenceDescription={evidenceDescription}
              onEvidenceDescriptionChange={setEvidenceDescription}
              evidenceUrl={evidenceUrl}
              onEvidenceUrlChange={setEvidenceUrl}
              onAddEvidence={onAddEvidence}
              processing={processing}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <TransferDetails dispute={dispute} isSender={isSender} isReceiver={isReceiver} />

            <DisputeActions
              isOpen={isOpen}
              isReceiver={isReceiver}
              processing={processing}
              onMutualAction={onMutualAction}
            />

            <ResolutionResult dispute={dispute} />
          </div>
        </div>
      </div>
    </div>
  );
}
