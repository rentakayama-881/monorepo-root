export default function IncompleteDataFallback({ onReset }) {
  return (
    <div className="space-y-4 text-center">
      <div className="rounded-lg border border-status-amber-border bg-status-amber-bg p-4">
        <p className="text-sm text-status-amber-text">
          Data pembayaran tidak lengkap. Silakan buat deposit baru.
        </p>
      </div>
      <button
        onClick={onReset}
        className="h-10 w-full rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
      >
        Buat Deposit Baru
      </button>
    </div>
  );
}
