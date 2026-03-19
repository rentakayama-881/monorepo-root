import { formatAmount } from "./disputeHelpers";

export default function ConfirmActionModal({
  pendingAction,
  actionNote,
  processing,
  dispute,
  onActionNoteChange,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">
          {pendingAction === "continue" && "Lanjutkan Transaksi"}
          {pendingAction === "force-release" && "Lepaskan Dana ke Penjual"}
          {pendingAction === "refund" && "Kembalikan Dana ke Pembeli"}
        </h3>

        <p className="text-sm text-muted-foreground mb-4">
          {pendingAction === "continue" &&
            "Transaksi akan dilanjutkan dan mengikuti masa hold normal. Sengketa akan ditutup."}
          {pendingAction === "force-release" &&
            `Dana ${formatAmount(dispute.amount)} akan langsung dikirim ke penjual @${dispute.respondentUsername}.`}
          {pendingAction === "refund" &&
            `Dana ${formatAmount(dispute.amount)} akan dikembalikan ke pembeli @${dispute.initiatorUsername}.`}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Catatan (opsional)
          </label>
          <textarea
            value={actionNote}
            onChange={(e) => onActionNoteChange(e.target.value)}
            placeholder="Tulis alasan keputusan..."
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 py-2 rounded-lg border border-border font-medium hover:bg-muted transition"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className={`flex-1 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
              pendingAction === "refund"
                ? "border border-warning/25 bg-warning/15 text-warning hover:bg-warning/20"
                : pendingAction === "force-release"
                  ? "border border-success/25 bg-success/15 text-success hover:bg-success/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {processing ? "Memproses..." : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
