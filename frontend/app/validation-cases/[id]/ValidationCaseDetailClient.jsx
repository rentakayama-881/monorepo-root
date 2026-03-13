"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TagList } from "@/components/ui/TagPill";
import ValidationCaseRecordSkeleton from "./ValidationCaseRecordSkeleton";
import { FEATURE_ENDPOINTS } from "@/lib/featureApi";
import { formatIDR, formatDateTime } from "@/lib/format";
import { isWorkspaceValidationCase } from "@/lib/validationCaseWorkflow";
import RepoWorkflowClient from "./repo/RepoWorkflowClient";
import {
  isSyntheticArtifactMarker,
  normalizeStatus,
  workflowSummaryLabel,
  consultationStatusLabel,
  sensitivityMeta,
  contentAsText,
  stripLeadingRecordLabel,
  looksLikeMarkdownText,
  sensitivityStakeRequirement,
} from "./components/validationCaseDetailUtils";
import { StatusBadge, CaseSection } from "./components/CaseSharedComponents";
import CaseLogPanel from "./components/CaseLogPanel";
import CaseMetadataSidebar from "./components/CaseMetadataSidebar";
import ContentTable, { extractCaseRecordText, hasOverviewContent } from "./components/ContentTable";
import ConsultationPanel from "./components/ConsultationPanel";
import FinalOffersPanel from "./components/FinalOffersPanel";
import EscrowPanel from "./components/EscrowPanel";
import ValidatorResultPanel from "./components/ValidatorResultPanel";
import DisputeAndReleasePanel from "./components/DisputeAndReleasePanel";
import { useValidationCaseWorkflow } from "./components/useValidationCaseWorkflow";

export default function ValidationCaseRecordPage({ initialCaseData = null }) {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const {
    loading,
    error,
    vc,
    me,
    isAuthed,
    isOwner,
    // Consultation
    consultationRequests,
    consultationLoading,
    consultationMsg,
    myConsultationRequest,
    myConsultationLoading,
    requestConsultationLoading,
    rejectForms,
    setRejectForms,
    rejectOpen,
    requestConsultation,
    approveConsultation,
    toggleRejectForm,
    submitRejectConsultation,
    // Contact
    contactTelegram,
    contactMsg,
    contactLoading,
    contactTelegramHref,
    contactTelegramLabel,
    revealContact,
    // Final offers
    finalOffers,
    offersLoading,
    offersMsg,
    finalOfferSubmitting,
    offerForm,
    setOfferForm,
    acceptingOfferId,
    submitFinalOffer,
    acceptFinalOffer,
    // Escrow
    escrowDraft,
    lockFundsPin,
    setLockFundsPin,
    lockFundsLoading,
    lockFundsMsg,
    lockFunds,
    // Artifact
    artifactSubmitting,
    artifactMsg,
    submitArtifact,
    // Release & dispute
    releasePin,
    setReleasePin,
    releaseLoading,
    releaseMsg,
    disputeForm,
    setDisputeForm,
    disputeLoading,
    disputeMsg,
    approveAndRelease,
    initiateDispute,
    // Case log
    caseLog,
    caseLogLoading,
    caseLogError,
  } = useValidationCaseWorkflow({ id, initialCaseData, router });

  if (!id || id === "undefined") return null;

  const loadingCaseMatchesRoute = String(vc?.id || "") === String(id || "");
  const loadingVariant = loadingCaseMatchesRoute
    ? isWorkspaceValidationCase(vc?.meta)
      ? "workspace"
      : "standard"
    : "generic";

  if (loading) {
    return <ValidationCaseRecordSkeleton variant={loadingVariant} />;
  }

  const status = normalizeStatus(vc?.status);
  const isWorkspaceMode = isWorkspaceValidationCase(vc?.meta);
  const consultationBlocked =
    status === "waiting_owner_response" || status === "on_hold_owner_inactive";
  const sensitivity = sensitivityMeta(vc?.sensitivity_level);
  const consultationStakeRequirement = sensitivityStakeRequirement(
    sensitivity.level,
    vc?.bounty_amount
  );
  const consultationRequested = Boolean(myConsultationRequest?.id);
  const consultationRequestStatus = consultationStatusLabel(myConsultationRequest?.status);
  const consultationButtonDisabled =
    consultationBlocked ||
    consultationRequested ||
    requestConsultationLoading ||
    myConsultationLoading;
  const contactRestricted = sensitivity.level === "S2" || sensitivity.level === "S3";
  const owner = vc?.owner || {};
  const ownerHandle = owner?.username ? `@${owner.username}` : `#${owner?.id || "-"}`;
  const ownerBadge = owner?.primary_badge || null;
  const transferId = vc?.escrow_transfer_id || "";
  const disputeId = vc?.dispute_id || "";
  const artifactId = vc?.artifact_document_id || "";
  const certifiedId = vc?.certified_artifact_document_id || "";
  const acceptedOfferId = Number(vc?.accepted_final_offer_id ?? vc?.acceptedFinalOfferId ?? 0);
  const acceptedOffer = acceptedOfferId
    ? finalOffers.find((offer) => Number(offer?.id) === acceptedOfferId) || null
    : null;
  const assignedValidator =
    (vc?.assigned_validator && vc.assigned_validator.id
      ? vc.assigned_validator
      : acceptedOffer?.validator) || null;
  const isAssignedValidator = Boolean(
    isAuthed &&
    !isOwner &&
    me?.id &&
    assignedValidator?.id &&
    Number(me.id) === Number(assignedValidator.id)
  );
  const hasSubmittedFinalOffer = !isOwner && Array.isArray(finalOffers) && finalOffers.length > 0;
  const disableSubmitFinalOffer = finalOfferSubmitting || offersLoading || hasSubmittedFinalOffer;

  const featureBase = (
    process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id"
  ).replace(/\/+$/, "");
  const certifiedDownloadHref =
    certifiedId && !isSyntheticArtifactMarker(certifiedId)
      ? `${featureBase}${FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD(String(certifiedId))}`
      : "";
  const recordContent = vc?.content_type === "text" ? contentAsText(vc?.content) : vc?.content;
  const caseReadmeMarkdown = (() => {
    const fromStructured = stripLeadingRecordLabel(extractCaseRecordText(recordContent));
    if (fromStructured) return fromStructured;
    if (typeof recordContent === "string") return stripLeadingRecordLabel(recordContent);
    return "";
  })();
  const showSummaryFallback = Boolean(vc?.summary) && !hasOverviewContent(recordContent);
  const filedAtLabel = formatDateTime(vc?.created_at);
  const workflowSummary = workflowSummaryLabel(status, {
    artifactId,
    transferId,
    acceptedFinalOfferId: acceptedOfferId,
  });

  if (vc && isWorkspaceMode) {
    return (
      <main className="container py-10 space-y-6">
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/validation-cases" prefetch={false} className="hover:underline">
            Daftar Case
          </Link>
          <span>/</span>
          <span className="font-mono text-xs text-foreground">#{String(id)}</span>
        </nav>

        {error ? (
          <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detail Case
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="font-mono text-xs text-foreground">#{String(id)}</span>
                  <span className="text-xs text-muted-foreground">Dibuat {filedAtLabel}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {vc?.title || "(tanpa judul)"}
                </h1>
                {vc?.summary && !looksLikeMarkdownText(vc?.summary) ? (
                  <p className="text-sm text-muted-foreground">{vc.summary}</p>
                ) : null}
              </div>

              {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                <TagList tags={vc.tags} size="sm" />
              ) : null}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{ownerHandle}</span>
                <span aria-hidden="true">•</span>
                <span>Sensitivitas {sensitivity.level}</span>
              </div>
            </div>

            <div className="w-full rounded-[var(--radius)] border border-border/70 bg-background px-4 py-4 lg:max-w-xs">
              <div className="text-xs text-muted-foreground">Bounty</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {formatIDR(vc?.bounty_amount)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Nilai hadiah untuk validator terpilih.
              </div>
            </div>
          </div>
        </section>

        <RepoWorkflowClient
          embedded
          caseReadmeMarkdown={caseReadmeMarkdown}
          caseTitle={vc?.title || ""}
          ownerUserId={owner?.id || 0}
          viewerUserId={Number(me?.id || 0)}
        />
      </main>
    );
  }

  return (
    <main className="container py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
          Daftar Case
        </Link>
        <span>/</span>
        <span className="font-mono text-xs text-foreground">#{String(id)}</span>
      </nav>

      {error ? (
        <div className="mb-6 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {vc ? (
        <article className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
          <div className="lg:col-span-8 space-y-6">
            <header className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detail Case
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="font-mono text-xs text-foreground">#{String(id)}</span>
                  <span className="text-xs text-muted-foreground">Dibuat {filedAtLabel}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {vc?.title || "(tanpa judul)"}
                </h1>
                {showSummaryFallback ? (
                  <p className="text-sm text-muted-foreground">{vc.summary}</p>
                ) : null}
              </div>

              {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                <TagList tags={vc.tags} size="sm" />
              ) : null}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{ownerHandle}</span>
                <span aria-hidden="true">•</span>
                <span>Sensitivitas {sensitivity.level}</span>
              </div>
            </header>

            <CaseSection title="Ringkasan Case">
              <ContentTable content={recordContent} />
            </CaseSection>

            <ConsultationPanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              status={status}
              sensitivity={sensitivity}
              consultationBlocked={consultationBlocked}
              consultationStakeRequirement={consultationStakeRequirement}
              consultationRequested={consultationRequested}
              consultationRequestStatus={consultationRequestStatus}
              consultationButtonDisabled={consultationButtonDisabled}
              requestConsultationLoading={requestConsultationLoading}
              myConsultationLoading={myConsultationLoading}
              consultationMsg={consultationMsg}
              contactRestricted={contactRestricted}
              contactLoading={contactLoading}
              contactTelegram={contactTelegram}
              contactTelegramHref={contactTelegramHref}
              contactTelegramLabel={contactTelegramLabel}
              contactMsg={contactMsg}
              onRequestConsultation={requestConsultation}
              onRevealContact={revealContact}
              consultationLoading={consultationLoading}
              consultationRequests={consultationRequests}
              rejectOpen={rejectOpen}
              rejectForms={rejectForms}
              onApproveConsultation={approveConsultation}
              onToggleRejectForm={toggleRejectForm}
              onRejectFormChange={(requestId, value) =>
                setRejectForms((prev) => ({ ...prev, [requestId]: value }))
              }
              onSubmitReject={submitRejectConsultation}
            />

            <FinalOffersPanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              status={status}
              bountyAmount={vc?.bounty_amount}
              offerForm={offerForm}
              finalOfferSubmitting={finalOfferSubmitting}
              disableSubmitFinalOffer={disableSubmitFinalOffer}
              offersLoading={offersLoading}
              offersMsg={offersMsg}
              finalOffers={finalOffers}
              acceptingOfferId={acceptingOfferId}
              hasSubmittedFinalOffer={hasSubmittedFinalOffer}
              transferId={transferId}
              disputeId={disputeId}
              onOfferFormChange={setOfferForm}
              onSubmitFinalOffer={submitFinalOffer}
              onAcceptFinalOffer={acceptFinalOffer}
            />

            <EscrowPanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              isAssignedValidator={isAssignedValidator}
              escrowDraft={escrowDraft}
              transferId={transferId}
              lockFundsPin={lockFundsPin}
              lockFundsLoading={lockFundsLoading}
              lockFundsMsg={lockFundsMsg}
              artifactId={artifactId}
              artifactSubmitting={artifactSubmitting}
              artifactMsg={artifactMsg}
              acceptedFinalOfferId={vc?.accepted_final_offer_id}
              onLockFundsPinChange={setLockFundsPin}
              onLockFunds={lockFunds}
              onSubmitArtifact={submitArtifact}
            />

            <ValidatorResultPanel
              artifactId={artifactId}
              assignedValidator={assignedValidator}
              certifiedId={certifiedId}
              certifiedDownloadHref={certifiedDownloadHref}
            />

            <DisputeAndReleasePanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              artifactId={artifactId}
              certifiedId={certifiedId}
              certifiedDownloadHref={certifiedDownloadHref}
              disputeId={disputeId}
              releasePin={releasePin}
              releaseLoading={releaseLoading}
              releaseMsg={releaseMsg}
              disputeForm={disputeForm}
              disputeLoading={disputeLoading}
              disputeMsg={disputeMsg}
              onReleasePinChange={setReleasePin}
              onApproveAndRelease={approveAndRelease}
              onDisputeFormChange={setDisputeForm}
              onInitiateDispute={initiateDispute}
            />

            <CaseLogPanel
              isAuthed={isAuthed}
              caseLog={caseLog}
              caseLogLoading={caseLogLoading}
              caseLogError={caseLogError}
            />
          </div>

          <CaseMetadataSidebar
            id={id}
            owner={owner}
            ownerBadge={ownerBadge}
            bountyAmount={vc?.bounty_amount}
            status={status}
            sensitivity={sensitivity}
            workflowSummary={workflowSummary}
            filedAtLabel={filedAtLabel}
          />
        </article>
      ) : null}
    </main>
  );
}
