export default function PinModal({
  pendingAction,
  pin,
  error,
  processing,
  onPinChange,
  onConfirm,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Confirm with PIN</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {pendingAction === "release" && "Enter PIN to release funds to recipient"}
          {pendingAction === "cancel" && "Enter PIN to cancel and refund funds"}
          {pendingAction === "reject" && "Enter PIN to reject transfer and return funds to sender"}
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => onPinChange(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-primary"
        />

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || pin.length !== 6}
            className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {processing ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
