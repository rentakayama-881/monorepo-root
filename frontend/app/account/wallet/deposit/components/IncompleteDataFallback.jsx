export default function IncompleteDataFallback({ onReset }) {
  return (
    <div className="space-y-4 text-center">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
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
