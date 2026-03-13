import Link from "next/link";
import NativeSelect from "@/components/ui/NativeSelect";
import { CaseSection } from "./CaseSharedComponents";

export default function DisputeAndReleasePanel({
  isAuthed,
  isOwner,
  artifactId,
  certifiedId,
  certifiedDownloadHref,
  disputeId,
  releasePin,
  releaseLoading,
  releaseMsg,
  disputeForm,
  disputeLoading,
  disputeMsg,
  onReleasePinChange,
  onApproveAndRelease,
  onDisputeFormChange,
  onInitiateDispute,
}) {
  if (!isAuthed || !isOwner || !artifactId) return null;

  return (
    <CaseSection title="Keputusan / Dispute" subtitle="Arbitrase">
      {certifiedId ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="font-semibold text-foreground">Certified Artifact</div>
          <div className="font-mono text-xs text-foreground">
            document_id: {String(certifiedId)}
          </div>
          {certifiedDownloadHref ? (
            <a
              href={certifiedDownloadHref}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Unduh Artifact Tersertifikasi
            </a>
          ) : null}
        </div>
      ) : disputeId ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="font-semibold text-foreground">Dispute</div>
          <div className="font-mono text-xs text-foreground">dispute_id: {String(disputeId)}</div>
          <Link
            href="/account/wallet/disputes"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Buka Pusat Sengketa
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Approve</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Jika deliverable memenuhi Final Offer, lakukan release escrow. Jika tidak ditekan
              manual, dana tetap auto-release saat hold window berakhir.
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Wallet PIN</label>
                <input
                  value={releasePin}
                  onChange={(e) => onReleasePinChange(e.target.value)}
                  placeholder="6 digit"
                  className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                  inputMode="numeric"
                  type="password"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={onApproveAndRelease}
                  className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  disabled={releaseLoading}
                  type="button"
                >
                  {releaseLoading ? "Melepas..." : "Lepas Escrow"}
                </button>
              </div>
            </div>
            {releaseMsg ? (
              <div className="mt-3 text-xs text-muted-foreground">{releaseMsg}</div>
            ) : null}
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground">Dispute</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Jika Anda menolak Artifact Submission, ajukan Dispute. Admin akan meninjau Final Offer
              dan Artifact Submission.
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Type</label>
                <NativeSelect
                  value={disputeForm.category}
                  onChange={(e) =>
                    onDisputeFormChange({ ...disputeForm, category: e.target.value })
                  }
                  className="mt-1 h-10"
                >
                  <option value="ItemNotAsDescribed">Artifact tidak sesuai terms</option>
                  <option value="ItemNotReceived">Artifact tidak diterima</option>
                  <option value="Fraud">Fraud / misrepresentation</option>
                  <option value="SellerNotResponding">Validator tidak responsif</option>
                  <option value="Other">Other</option>
                </NativeSelect>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Reason</label>
                <textarea
                  value={disputeForm.reason}
                  onChange={(e) => onDisputeFormChange({ ...disputeForm, reason: e.target.value })}
                  rows={4}
                  placeholder="Minimal 20 karakter. Cantumkan poin sengketa yang dapat diverifikasi."
                  className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={onInitiateDispute}
                className="rounded-[var(--radius)] border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60 disabled:opacity-60"
                disabled={disputeLoading}
                type="button"
              >
                {disputeLoading ? "Mengirim..." : "Ajukan Dispute"}
              </button>
            </div>
            {disputeMsg ? (
              <div className="mt-3 text-xs text-muted-foreground">{disputeMsg}</div>
            ) : null}
          </div>
        </div>
      )}
    </CaseSection>
  );
}
