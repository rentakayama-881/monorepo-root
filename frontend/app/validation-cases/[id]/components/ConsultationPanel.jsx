import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { formatIDR, formatDateTime } from "@/lib/format";
import { normalizeStatus } from "./validationCaseDetailUtils";
import { CaseSection } from "./CaseSharedComponents";

export default function ConsultationPanel({
  isAuthed,
  isOwner,
  status,
  sensitivity,
  consultationBlocked,
  consultationStakeRequirement,
  consultationRequested,
  consultationRequestStatus,
  consultationButtonDisabled,
  requestConsultationLoading,
  myConsultationLoading,
  consultationMsg,
  contactRestricted,
  contactLoading,
  contactTelegram,
  contactTelegramHref,
  contactTelegramLabel,
  contactMsg,
  onRequestConsultation,
  onRevealContact,
  // Owner-specific
  consultationLoading,
  consultationRequests,
  rejectOpen,
  rejectForms,
  onApproveConsultation,
  onToggleRejectForm,
  onRejectFormChange,
  onSubmitReject,
}) {
  return (
    <>
      <CaseSection title="Permintaan Konsultasi" subtitle="Protokol">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Aturan</div>
            <ul className="mt-2 list-disc pl-5">
              <li>
                Stake rule: S0 tanpa minimum stake, S1 minimal Rp 100.000, S2 minimal Rp 500.000, S3
                minimal sama dengan bounty case.
              </li>
              <li>
                Kontak Telegram dibuka privat setelah persetujuan pemilik kasus dan dicatat pada
                Case Log.
              </li>
              <li>
                Jika validator meminta klarifikasi, status menjadi WAITING_OWNER_RESPONSE dengan SLA
                owner 12 jam.
              </li>
              <li>
                Jika owner tidak merespons sampai SLA habis, kasus auto ON_HOLD_OWNER_INACTIVE tanpa
                reassignment validator.
              </li>
            </ul>
          </div>
          <div className="md:border-l md:border-border md:pl-6">
            {!isAuthed ? (
              <div className="text-sm text-muted-foreground">
                Login diperlukan untuk mengajukan konsultasi.
                <div className="mt-3">
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Masuk
                  </Link>
                </div>
              </div>
            ) : isOwner ? (
              <div className="text-sm text-muted-foreground">
                Anda adalah pemilik case ini. Kelola permintaan konsultasi pada bagian berikutnya.
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={onRequestConsultation}
                  variant={consultationRequested ? "secondary" : "gradient"}
                  loading={requestConsultationLoading}
                  disabled={consultationButtonDisabled}
                  className={
                    consultationRequested
                      ? "border border-primary/30 bg-primary/10 text-primary disabled:opacity-100"
                      : ""
                  }
                >
                  {consultationRequested ? "Permintaan Terkirim" : "Ajukan Konsultasi"}
                </Button>
                <div className="text-xs text-muted-foreground">{consultationStakeRequirement}</div>
                {consultationRequested ? (
                  <div className="text-xs text-primary">
                    Status request Anda: {consultationRequestStatus}.
                  </div>
                ) : null}
                {consultationBlocked ? (
                  <div className="text-xs text-muted-foreground">
                    Permintaan baru ditutup sementara karena kasus menunggu respons owner atau
                    sedang on-hold owner inactive.
                  </div>
                ) : null}
                {myConsultationLoading ? (
                  <div className="w-44">
                    <Skeleton className="h-3.5 w-44" />
                  </div>
                ) : null}
                {consultationMsg ? (
                  <div className="text-xs text-muted-foreground">{consultationMsg}</div>
                ) : null}

                <div className="h-px bg-border" />

                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kontak Privat
                </div>
                {contactRestricted ? (
                  <div className="text-xs text-muted-foreground">
                    Telegram private contact dinonaktifkan untuk tier {sensitivity.level} (
                    {sensitivity.label}).
                  </div>
                ) : null}
                <Button
                  onClick={onRevealContact}
                  variant="outline"
                  disabled={contactLoading || contactRestricted}
                >
                  {contactLoading ? "Membuka..." : "Buka Telegram (Privat)"}
                </Button>
                {contactTelegram ? (
                  <div className="text-sm">
                    <a
                      href={contactTelegramHref || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline"
                    >
                      {contactTelegramLabel}
                    </a>
                  </div>
                ) : null}
                {contactMsg ? (
                  <div className="text-xs text-muted-foreground">{contactMsg}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </CaseSection>

      {isAuthed && isOwner && (status === "open" || status === "waiting_owner_response") ? (
        <CaseSection title="Daftar Permintaan Konsultasi" subtitle="Tinjauan Owner">
          {consultationLoading ? (
            <div
              className="rounded-[var(--radius)] border border-border/70 bg-background p-4"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="grid grid-cols-6 gap-3 border-b border-border pb-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={`consult-head-${i}`} className="h-3.5 w-16" />
                ))}
              </div>
              <div className="space-y-3 pt-3">
                {Array.from({ length: 3 }).map((_, row) => (
                  <div key={`consult-row-${row}`} className="grid grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((__, col) => (
                      <Skeleton key={`consult-cell-${row}-${col}`} className="h-4 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : consultationRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada Request Consultation.</div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="min-w-[920px] w-full text-sm"
                aria-label="Daftar permintaan konsultasi"
              >
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-xs">
                      Validator
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-xs">
                      Match Score
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-xs">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-xs">
                      Filed
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-xs">
                      SLA Due
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-xs">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consultationRequests.map((r) => (
                    <tr key={String(r.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={r?.validator?.avatar_url}
                            name={r?.validator?.username || ""}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={
                                  r?.validator?.username
                                    ? `/user/${encodeURIComponent(r.validator.username)}`
                                    : "#"
                                }
                                className="truncate font-semibold text-foreground hover:underline"
                              >
                                @{r?.validator?.username || "-"}
                              </Link>
                              {r?.validator?.primary_badge ? (
                                <Badge badge={r.validator.primary_badge} size="xs" />
                              ) : null}
                            </div>
                            {Number(r?.validator?.guarantee_amount || 0) > 0 ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                Stake: {formatIDR(r.validator.guarantee_amount)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r?.matching_score ? (
                          <div>
                            <div className="font-mono text-xs font-semibold text-foreground">
                              {Number(r.matching_score.total || 0)}/100
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              D:{Number(r.matching_score.domain_fit || 0)} E:
                              {Number(r.matching_score.evidence_fit || 0)} H:
                              {Number(r.matching_score.history_dispute || 0)} R:
                              {Number(r.matching_score.responsiveness_sla || 0)} S:
                              {Number(r.matching_score.stake_guarantee || 0)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {String(r.status || "")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r?.owner_response_due_at ? formatDateTime(r.owner_response_due_at) : "-"}
                        {Number(r?.reminder_count || 0) > 0 ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            reminder: {Number(r.reminder_count)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {normalizeStatus(r.status) === "pending" ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                onClick={() => onApproveConsultation(r.id)}
                              >
                                Approve
                              </button>
                              <button
                                className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                onClick={() => onToggleRejectForm(r.id)}
                              >
                                Reject
                              </button>
                            </div>
                            {rejectOpen[r.id] ? (
                              <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-2">
                                <textarea
                                  value={rejectForms[r.id] || ""}
                                  onChange={(e) => onRejectFormChange(r.id, e.target.value)}
                                  placeholder="Alasan penolakan (min 5 karakter)"
                                  rows={3}
                                  className="w-full rounded-[var(--radius)] border border-input bg-card px-2 py-1.5 text-xs text-foreground"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => onSubmitReject(r.id)}
                                    className="rounded-[var(--radius)] bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                  >
                                    Submit
                                  </button>
                                  <button
                                    onClick={() => onToggleRejectForm(r.id)}
                                    className="rounded-[var(--radius)] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {consultationMsg ? (
            <div className="mt-3 text-xs text-muted-foreground">{consultationMsg}</div>
          ) : null}
        </CaseSection>
      ) : null}
    </>
  );
}
