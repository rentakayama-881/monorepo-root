import Link from "next/link";
import { formatIDR } from "@/lib/format";
import { CaseSection } from "./CaseSharedComponents";

export default function EscrowPanel({
  isAuthed,
  isOwner,
  isAssignedValidator,
  escrowDraft,
  transferId,
  lockFundsPin,
  lockFundsLoading,
  lockFundsMsg,
  artifactId,
  artifactSubmitting,
  artifactMsg,
  acceptedFinalOfferId,
  onLockFundsPinChange,
  onLockFunds,
  onSubmitArtifact,
}) {
  return (
    <>
      {isAuthed && isOwner && (escrowDraft || acceptedFinalOfferId) ? (
        <CaseSection title="Kunci Dana" subtitle="Escrow">
          {transferId ? (
            <div className="text-sm text-muted-foreground">
              Escrow terpasang.
              <div className="mt-2 font-mono text-xs text-foreground">
                transfer_id: {String(transferId)}
              </div>
            </div>
          ) : escrowDraft ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Escrow Draft</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Detail eskro">
                    <tbody className="divide-y divide-border">
                      <tr>
                        <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Receiver
                        </th>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <Link
                            href={`/user/${encodeURIComponent(escrowDraft.receiver_username)}`}
                            prefetch={false}
                            className="hover:underline hover:text-primary"
                          >
                            @{escrowDraft.receiver_username}
                          </Link>
                        </td>
                      </tr>
                      <tr>
                        <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Jumlah
                        </th>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {formatIDR(escrowDraft.amount)}
                        </td>
                      </tr>
                      <tr>
                        <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Hold
                        </th>
                        <td className="px-4 py-3 text-muted-foreground">
                          {Math.round((Number(escrowDraft.hold_hours) || 0) / 24)} hari
                        </td>
                      </tr>
                      <tr>
                        <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Pesan
                        </th>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {escrowDraft.message}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Wallet PIN</label>
                  <input
                    value={lockFundsPin}
                    onChange={(e) => onLockFundsPinChange(e.target.value)}
                    placeholder="6 digit"
                    className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                    inputMode="numeric"
                    type="password"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={onLockFunds}
                    className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    disabled={lockFundsLoading}
                    type="button"
                  >
                    {lockFundsLoading ? "Mengunci..." : "Kunci Dana"}
                  </button>
                </div>
              </div>

              {lockFundsMsg ? (
                <div className="text-xs text-muted-foreground">{lockFundsMsg}</div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Tidak ada escrow draft. Langkah ini aktif setelah Final Offer diterima.
            </div>
          )}
        </CaseSection>
      ) : null}

      {isAuthed && !isOwner && transferId && isAssignedValidator ? (
        <CaseSection title="Konfirmasi Pengiriman" subtitle="Penyerahan">
          {artifactId ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              Artifact submission sudah tercatat dan menunggu keputusan owner.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Tidak perlu upload file. Klik konfirmasi ini setelah deliverable selesai dikirim via
                Telegram.
              </div>
              <button
                onClick={onSubmitArtifact}
                className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                disabled={artifactSubmitting}
                type="button"
              >
                {artifactSubmitting ? "Submitting..." : "Confirm Delivery"}
              </button>
              {artifactMsg ? (
                <div className="text-xs text-muted-foreground">{artifactMsg}</div>
              ) : null}
            </div>
          )}
        </CaseSection>
      ) : null}
    </>
  );
}
