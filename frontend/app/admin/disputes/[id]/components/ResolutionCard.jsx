import { formatAmount } from "./disputeHelpers";

export default function ResolutionCard({ resolution }) {
  return (
    <div className="bg-success/10 rounded-lg border border-success/20 p-6">
      <h2 className="font-semibold text-success mb-4">✅ Keputusan</h2>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Tipe:</span>
          <div className="font-medium text-foreground">
            {resolution.type === "FullRefundToSender" && "Refund ke Pembeli"}
            {resolution.type === "FullReleaseToReceiver" && "Release ke Penjual"}
            {resolution.type === "Split" && "Dibagi"}
            {resolution.type === "NoAction" && "Transaksi Dilanjutkan"}
          </div>
        </div>
        {resolution.refundToSender > 0 && (
          <div>
            <span className="text-muted-foreground">Ke Pembeli:</span>
            <div className="font-medium text-foreground">
              Rp {formatAmount(resolution.refundToSender)}
            </div>
          </div>
        )}
        {resolution.releaseToReceiver > 0 && (
          <div>
            <span className="text-muted-foreground">Ke Penjual:</span>
            <div className="font-medium text-foreground">
              Rp {formatAmount(resolution.releaseToReceiver)}
            </div>
          </div>
        )}
        {resolution.note && (
          <div>
            <span className="text-muted-foreground">Catatan:</span>
            <div className="text-foreground">{resolution.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}
