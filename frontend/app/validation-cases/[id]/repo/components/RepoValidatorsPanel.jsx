import Spinner from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

function ConfidenceIcon({ active = false }) {
  return (
    <ShieldCheck
      className={`h-4 w-4 ${active ? "text-success" : "text-muted-foreground"}`}
      aria-hidden="true"
    />
  );
}

export default function RepoValidatorsPanel({
  isOwner,
  isAssigned,
  stakeEligible,
  repoTree,
  applicants,
  assignments,
  confidenceByValidator,
  viewerUserId,
  actionLocked,
  applyDisabled,
  applyingValidator,
  assigningValidatorID,
  votingValidatorID,
  onApply,
  onAssignValidator,
  onVoteConfidence,
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Validators</h2>

      {!isOwner ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onApply}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={applyDisabled}
            aria-live="polite"
          >
            {applyingValidator ? (
              <>
                <Spinner className="h-3.5 w-3.5 border-border border-t-foreground" />
                <span>Mengirim apply...</span>
              </>
            ) : isAssigned ? (
              "Anda sudah diassign"
            ) : (
              "Apply as Validator"
            )}
          </button>
          {applyingValidator ? (
            <div className="text-xs text-primary">Request apply sedang diproses...</div>
          ) : null}
          {repoTree && !stakeEligible ? (
            <div className="text-xs text-amber-700">
              Stake kamu belum memenuhi syarat untuk apply case ini.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Owner melakukan assign validator manual dari daftar applicant.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-sm font-semibold text-foreground">Applicants</div>
          {applicants.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">Belum ada applicant.</div>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {applicants.map((it) => (
                <li key={`app-${it.id}`} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">
                    #{it.id} {it.username ? `@${it.username}` : ""}
                  </span>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => onAssignValidator(it.id)}
                      disabled={actionLocked || assigningValidatorID === String(it.id)}
                      className="rounded-[var(--radius)] border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {assigningValidatorID === String(it.id) ? "Assigning..." : "Assign"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold text-foreground">Assigned Validators</div>
          {assignments.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">
              Belum ada validator yang diassign.
            </div>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {assignments.map((item) => {
                const validatorId = Number(item?.validator?.id || item?.validator_user_id || 0);
                const score = confidenceByValidator.get(validatorId);
                const votes = Number(score?.votes || 0);
                const viewerVoted = Boolean(score?.viewer_voted);
                const hasOutput = Boolean(score?.has_uploaded_output);
                const isSelfTarget =
                  viewerUserId > 0 && validatorId > 0 && Number(viewerUserId) === validatorId;
                return (
                  <li key={`as-${validatorId}`} className="py-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-foreground">
                        #{validatorId}{" "}
                        {item?.validator?.username ? `@${item.validator.username}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(item?.assigned_at)}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>status: {item?.status || "-"}</span>
                      <span>uploaded: {hasOutput ? "yes" : "no"}</span>
                      <span>confidence votes: {votes}</span>
                    </div>
                    {!isOwner ? (
                      <button
                        type="button"
                        onClick={() => onVoteConfidence(validatorId)}
                        disabled={Boolean(votingValidatorID) || validatorId <= 0 || isSelfTarget}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ConfidenceIcon active={viewerVoted} />
                        {validatorId <= 0
                          ? "Unavailable"
                          : isSelfTarget
                            ? "Self"
                            : votingValidatorID === String(validatorId)
                              ? "Saving..."
                              : viewerVoted
                                ? "Voted"
                                : "Confidence"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
