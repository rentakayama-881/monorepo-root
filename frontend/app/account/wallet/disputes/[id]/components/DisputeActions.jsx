export default function DisputeActions({ isOpen, isReceiver, processing, onMutualAction }) {
  if (!isOpen) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground mb-4">Actions</h3>
      <div className="space-y-3">
        {/* Refund - Only receiver (penjual) can agree to refund */}
        {isReceiver ? (
          <button
            onClick={() => onMutualAction("refund")}
            disabled={processing}
            className="w-full rounded-lg border border-border py-2 text-sm font-medium transition hover:bg-background disabled:opacity-50"
          >
            Agree to Sender Refund
          </button>
        ) : (
          <div className="text-xs text-muted-foreground bg-warning/5 border border-warning/20 rounded-lg p-3">
            <p className="font-medium text-warning mb-1">Awaiting Response</p>
            <p>
              You opened this dispute. Wait for the recipient response or escalate to admin review
              if necessary.
            </p>
          </div>
        )}

        {/* Info for receiver about defense */}
        {isReceiver && (
          <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="font-medium text-primary mb-1">Info</p>
            <p>
              If you want to proceed with this transaction, provide your response in chat. The team
              will decide based on the discussion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
