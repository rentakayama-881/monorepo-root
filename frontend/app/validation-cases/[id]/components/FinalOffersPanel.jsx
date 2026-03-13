import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatIDR } from "@/lib/format";
import { formatHoldWindow, normalizeStatus } from "./validationCaseDetailUtils";
import { CaseSection } from "./CaseSharedComponents";

export default function FinalOffersPanel({
  isAuthed,
  isOwner,
  status,
  bountyAmount,
  offerForm,
  finalOfferSubmitting,
  disableSubmitFinalOffer,
  offersLoading,
  offersMsg,
  finalOffers,
  acceptingOfferId,
  hasSubmittedFinalOffer,
  transferId,
  disputeId,
  onOfferFormChange,
  onSubmitFinalOffer,
  onAcceptFinalOffer,
}) {
  return (
    <CaseSection title="Penawaran Final" subtitle="Kontrak">
      {isAuthed && !isOwner && status === "open" ? (
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Submission Notes</div>
            <ul className="mt-2 list-disc pl-5">
              <li>Amount Final Offer mengikuti bounty_amount pada Validation Case (fixed).</li>
              <li>Validator memilih hold window (auto-release) dan terms yang dapat diaudit.</li>
              <li>Pemilik kasus akan melakukan Lock Funds setelah menerima Final Offer.</li>
              <li>Hindari menyertakan info kontak di Terms.</li>
            </ul>
          </div>

          <div className="md:border-l md:border-border md:pl-6">
            <div className="text-sm font-semibold text-foreground">Submit Final Offer</div>
            <div className="mt-3 space-y-3">
              <div className="rounded-[var(--radius)] border border-border bg-secondary/30 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Amount (locked funds)
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {formatIDR(bountyAmount)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Sesuai bounty_amount (tidak dapat diubah di Final Offer).
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Hold window</label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => onOfferFormChange({ ...offerForm, hold_hours: 32 })}
                    disabled={disableSubmitFinalOffer}
                    className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                      Number(offerForm.hold_hours) === 32
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="text-sm font-semibold">1 hari 8 jam</div>
                    <div className="text-[11px] opacity-70">Tugas ringan</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOfferFormChange({ ...offerForm, hold_hours: 168 })}
                    disabled={disableSubmitFinalOffer}
                    className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                      Number(offerForm.hold_hours) === 168
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="text-sm font-semibold">7 hari</div>
                    <div className="text-[11px] opacity-70">Standar</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOfferFormChange({ ...offerForm, hold_hours: 720 })}
                    disabled={disableSubmitFinalOffer}
                    className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                      Number(offerForm.hold_hours) === 720
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="text-sm font-semibold">30 hari</div>
                    <div className="text-[11px] opacity-70">Kasus kompleks</div>
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Dana auto-release ketika hold berakhir jika tidak ada Dispute.
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold text-muted-foreground">Terms</label>
              <textarea
                value={offerForm.terms}
                onChange={(e) => onOfferFormChange({ ...offerForm, terms: e.target.value })}
                rows={4}
                placeholder="Scope, acceptance criteria, assumptions, excluded items."
                className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                disabled={disableSubmitFinalOffer}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={onSubmitFinalOffer}
                disabled={disableSubmitFinalOffer}
                className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {hasSubmittedFinalOffer
                  ? "Sudah Dikirim"
                  : finalOfferSubmitting
                    ? "Mengirim..."
                    : "Kirim"}
              </button>
            </div>
            {offersMsg ? (
              <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {offersLoading ? (
        <div
          className="rounded-[var(--radius)] border border-border/70 bg-background p-4"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="grid grid-cols-6 gap-3 border-b border-border pb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`offer-head-${i}`} className="h-3.5 w-16" />
            ))}
          </div>
          <div className="space-y-3 pt-3">
            {Array.from({ length: 3 }).map((_, row) => (
              <div key={`offer-row-${row}`} className="grid grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((__, col) => (
                  <Skeleton key={`offer-cell-${row}-${col}`} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : finalOffers.length === 0 ? (
        <div className="text-sm text-muted-foreground">Belum ada Final Offer.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                  Validator
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                  Hold
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                  Terms
                </th>
                {isAuthed && isOwner ? (
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                    Action
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {finalOffers.map((o) => (
                <tr key={String(o.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={o?.validator?.avatar_url}
                        name={o?.validator?.username || ""}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={
                              o?.validator?.username
                                ? `/user/${encodeURIComponent(o.validator.username)}`
                                : "#"
                            }
                            className="truncate font-semibold text-foreground hover:underline"
                          >
                            @{o?.validator?.username || "-"}
                          </Link>
                          {o?.validator?.primary_badge ? (
                            <Badge badge={o.validator.primary_badge} size="xs" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{formatIDR(o.amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {formatHoldWindow(o.hold_hours)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {String(o.status || "")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {o?.terms ? (
                      <div className="line-clamp-3 whitespace-pre-wrap">{o.terms}</div>
                    ) : (
                      "-"
                    )}
                  </td>
                  {isAuthed && isOwner ? (
                    <td className="px-4 py-3">
                      {normalizeStatus(o.status) === "submitted" && !transferId && !disputeId ? (
                        <button
                          onClick={() => onAcceptFinalOffer(o.id)}
                          className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={acceptingOfferId !== null}
                          type="button"
                        >
                          {Number(acceptingOfferId) === Number(o.id) ? "Memproses..." : "Terima"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAuthed && isOwner && offersMsg ? (
        <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div>
      ) : null}
    </CaseSection>
  );
}
