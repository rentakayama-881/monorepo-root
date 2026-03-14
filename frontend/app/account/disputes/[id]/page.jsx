"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import useDisputeDetail from "./useDisputeDetail";
import DisputeTimeline from "./components/DisputeTimeline";
import DisputeEvidence from "./components/DisputeEvidence";
import DisputeActions from "./components/DisputeActions";

export default function DisputeCenterPage() {
  const {
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
  } = useDisputeDetail();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !dispute) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-card rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-foreground mb-2">Unable to Access Dispute</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link href="/account/wallet/transactions" className="text-primary hover:underline">
              ← Back to Transactions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/account/wallet/transactions"
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Transactions
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">Mediation Center</h1>
          <p className="text-muted-foreground">
            Resolve transaction issues with support from our mediation team
          </p>
        </div>

        <DisputeTimeline dispute={dispute} disputeId={disputeId} isInitiator={isInitiator} />

        <DisputeActions
          dispute={dispute}
          currentUserId={currentUserId}
          isClosed={isClosed}
          message={message}
          setMessage={setMessage}
          sending={sending}
          error={error}
          messagesContainerRef={messagesContainerRef}
          handleMessagesScroll={handleMessagesScroll}
          handleSendMessage={handleSendMessage}
        />

        <DisputeEvidence evidence={dispute?.evidence} />
      </div>
    </div>
  );
}
