export default function AdminActionsCard({ onAction }) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="font-semibold text-foreground mb-4">Keputusan Admin</h2>
      <div className="space-y-3">
        <button
          onClick={() => onAction("continue")}
          className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          🔄 Lanjutkan Transaksi
        </button>
        <button
          onClick={() => onAction("force-release")}
          className="w-full py-3 px-4 rounded-lg border border-success/25 bg-success/15 text-success font-medium hover:bg-success/20 transition"
        >
          💰 Lepaskan ke Penjual
        </button>
        <button
          onClick={() => onAction("refund")}
          className="w-full py-3 px-4 rounded-lg border border-warning/25 bg-warning/15 text-warning font-medium hover:bg-warning/20 transition"
        >
          ↩️ Kembalikan ke Pembeli
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        ⚠️ Keputusan tidak dapat dibatalkan. Pastikan Anda telah meninjau semua bukti.
      </p>
    </div>
  );
}
