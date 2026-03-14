export default function SendConfirmStep({
  selectedUser,
  amount,
  holdDays,
  description,
  pin,
  onPinChange,
  error,
  loading,
  onSubmit,
  onBack,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Ringkasan Transfer</h3>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Recipient</span>
          <span className="font-medium text-foreground">{selectedUser?.username}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Jumlah</span>
          <span className="font-bold text-lg text-foreground">Rp {amount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Periode Hold</span>
          <span className="font-medium text-foreground">{holdDays} Hari</span>
        </div>
        {description && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deskripsi</span>
            <span className="font-medium text-foreground text-right max-w-48 truncate">
              {description}
            </span>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm text-muted-foreground">
        <p>
          Funds will be held for {holdDays} days. After the hold period ends, funds are
          automatically released to {selectedUser?.username}. You can release them earlier from the
          Transactions menu.
        </p>
      </div>

      {/* PIN */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Enter Transaction PIN
        </label>
        <input
          type="password"
          data-testid="transfer-pin-input"
          value={pin}
          onChange={(e) => onPinChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          maxLength={6}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-center text-2xl tracking-widest text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-border bg-card py-3 font-semibold text-foreground transition hover:bg-muted/50"
        >
          Back
        </button>
        <button
          type="submit"
          data-testid="transfer-submit-button"
          disabled={loading || pin.length !== 6}
          className="flex-1 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send Funds"}
        </button>
      </div>
    </form>
  );
}
