"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import Skeleton from "@/components/ui/Skeleton";
import { formatIDR } from "@/lib/format";
import WorkspaceWorkflowSkeleton from "../WorkspaceWorkflowSkeleton";
import { useRepoWorkflow } from "./components/useRepoWorkflow";
import RepoFileTable from "./components/RepoFileTable";
import RepoAttachForm from "./components/RepoAttachForm";
import RepoValidatorsPanel from "./components/RepoValidatorsPanel";

function RepoWorkspaceSkeleton({ embedded = false, caseTitle = "" }) {
  const skeletonContent = <WorkspaceWorkflowSkeleton />;

  if (embedded) {
    return <section className="min-h-[62vh] py-1">{skeletonContent}</section>;
  }

  return (
    <main className="container min-h-screen py-10 space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-36" />
        <span>/</span>
        <Skeleton className="h-4 w-20" />
        <span>/</span>
        <Skeleton className="h-4 w-12" />
      </nav>
      {caseTitle ? (
        <h1 className="text-2xl font-semibold text-foreground">{caseTitle}</h1>
      ) : (
        <Skeleton className="h-8 w-72" />
      )}
      {skeletonContent}
    </main>
  );
}

export default function RepoWorkflowClient({
  embedded = false,
  caseReadmeMarkdown = "",
  caseTitle = "",
  ownerUserId = 0,
  viewerUserId = 0,
}) {
  const params = useParams();
  const router = useRouter();
  const id = useMemo(() => String(params?.id || ""), [params?.id]);

  const {
    loading,
    error,
    msg,
    repoTree,
    isOwner,
    isAssigned,
    files,
    applicants,
    assignments,
    confidenceByValidator,
    canAttach,
    actionLocked,
    stakeEligible,
    applyDisabled,
    canFinalize,
    payout,
    attachForm,
    setAttachForm,
    attachFileInputKey,
    attachKindOptions,
    uploadingDocument,
    uploadProgress,
    downloadingDocumentID,
    applyingValidator,
    assigningValidatorID,
    votingValidatorID,
    loadAll,
    onAttachFile,
    openWorkspaceFile,
    onApply,
    onAssignValidator,
    onVoteConfidence,
    onFinalize,
  } = useRepoWorkflow({ id, router });

  if (loading) {
    return <RepoWorkspaceSkeleton embedded={embedded} caseTitle={caseTitle} />;
  }

  const content = (
    <div className="space-y-7">
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadAll({ withSkeleton: true })}
            className="shrink-0 rounded-[var(--radius)] border border-destructive/30 px-3 py-1 text-xs font-medium hover:bg-destructive/10"
          >
            Coba lagi
          </button>
        </div>
      ) : null}
      {msg ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius)] bg-success/10 px-4 py-3 text-sm text-success"
        >
          {msg}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">File Repo</h2>
        <RepoFileTable
          files={files}
          ownerUserId={ownerUserId}
          actionLocked={actionLocked}
          downloadingDocumentID={downloadingDocumentID}
          onOpenFile={openWorkspaceFile}
        />
        {canAttach ? (
          <RepoAttachForm
            attachForm={attachForm}
            setAttachForm={setAttachForm}
            attachFileInputKey={attachFileInputKey}
            attachKindOptions={attachKindOptions}
            isOwner={isOwner}
            actionLocked={actionLocked}
            uploadingDocument={uploadingDocument}
            uploadProgress={uploadProgress}
            onSubmit={onAttachFile}
          />
        ) : null}
      </section>

      <RepoValidatorsPanel
        isOwner={isOwner}
        isAssigned={isAssigned}
        stakeEligible={stakeEligible}
        repoTree={repoTree}
        applicants={applicants}
        assignments={assignments}
        confidenceByValidator={confidenceByValidator}
        viewerUserId={viewerUserId}
        actionLocked={actionLocked}
        applyDisabled={applyDisabled}
        applyingValidator={applyingValidator}
        assigningValidatorID={assigningValidatorID}
        votingValidatorID={votingValidatorID}
        onApply={onApply}
        onAssignValidator={onAssignValidator}
        onVoteConfidence={onVoteConfidence}
      />

      {isOwner ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Finalisasi Case</h2>
          <div className="text-sm text-muted-foreground">
            Finalisasi membutuhkan minimal{" "}
            <span className="font-semibold text-foreground">
              {repoTree?.minimum_validator_uploads || 3}
            </span>{" "}
            validator upload hasil.
          </div>
          <div className="text-sm text-muted-foreground">
            Progress saat ini:{" "}
            <span className="font-semibold text-foreground">
              {repoTree?.uploaded_validator_count || 0}
            </span>{" "}
            validator upload.
          </div>
          <button
            type="button"
            onClick={onFinalize}
            disabled={actionLocked || !canFinalize}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLocked ? "Memproses..." : "Finalize Case"}
          </button>
        </section>
      ) : null}

      {payout ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Payout Result</h2>
          <div className="text-sm text-muted-foreground">
            Total bounty: {formatIDR(payout?.bounty_amount || 0)}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3">Validator</th>
                  <th className="py-2 pr-3">Confidence Votes</th>
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(payout?.entries || []).map((entry) => (
                  <tr key={`pay-${entry.validator_user_id}`}>
                    <td className="py-2 pr-3 text-foreground">#{entry.validator_user_id}</td>
                    <td className="py-2 pr-3 text-foreground">{entry.confidence_votes || 0}</td>
                    <td className="py-2 pr-3 font-semibold text-foreground">
                      {formatIDR(entry.amount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">README</h2>
        <div className="mt-2">
          {String(caseReadmeMarkdown || "").trim() ? (
            <div className="prose prose-neutral max-w-none">
              <MarkdownPreview content={caseReadmeMarkdown} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">README belum tersedia.</div>
          )}
        </div>
      </section>
    </div>
  );

  if (embedded) {
    return <section className="space-y-6">{content}</section>;
  }

  return (
    <main className="container py-10 space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/validation-cases" className="hover:underline" prefetch={false}>
          Daftar Case
        </Link>
        <span>/</span>
        <Link
          href={`/validation-cases/${encodeURIComponent(id)}`}
          className="hover:underline"
          prefetch={false}
        >
          <span className="font-mono text-xs">#{id}</span>
        </Link>
        <span>/</span>
        <span className="text-foreground">Repo</span>
      </nav>
      {caseTitle ? <h1 className="text-2xl font-semibold text-foreground">{caseTitle}</h1> : null}
      {content}
    </main>
  );
}
