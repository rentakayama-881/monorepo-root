import { formatDate, formatAmount, getCategoryLabel } from "./disputeHelpers";

export default function DisputeInfoCard({ dispute }) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="font-semibold text-foreground mb-4">Detail Dispute</h2>

      <div className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Kategori:</span>
          <div className="font-medium text-foreground">{getCategoryLabel(dispute.category)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Jumlah:</span>
          <div className="font-bold text-primary text-lg">Rp {formatAmount(dispute.amount)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Dibuat:</span>
          <div className="text-foreground">{formatDate(dispute.createdAt)}</div>
        </div>
      </div>

      <hr className="my-4 border-border" />

      <h3 className="font-medium text-foreground mb-2">Pihak Terlibat</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pembeli (Pengirim):</span>
          <span className="font-medium text-foreground">
            @{dispute.senderUsername || dispute.initiatorUsername}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Penjual (Penerima):</span>
          <span className="font-medium text-foreground">
            @{dispute.receiverUsername || dispute.respondentUsername}
          </span>
        </div>
      </div>

      <hr className="my-4 border-border" />

      <h3 className="font-medium text-foreground mb-2">Alasan Dispute</h3>
      <p className="text-sm text-muted-foreground">{dispute.reason}</p>
    </div>
  );
}
