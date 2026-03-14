import { formatCurrency } from "../useSendTransfer";

export default function SendAmountStep({
  selectedUser,
  amount,
  onAmountChange,
  holdDays,
  onHoldDaysChange,
  description,
  onDescriptionChange,
  error,
  onNext,
  onBack,
  onChangeUser,
}) {
  return (
    <div className="space-y-4">
      {/* Selected User */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {selectedUser?.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="font-medium text-foreground">{selectedUser?.username}</div>
          <div className="text-xs text-muted-foreground">Recipient</div>
        </div>
        <button onClick={onChangeUser} className="text-sm text-primary hover:underline">
          Ubah
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Jumlah Transfer</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
          <input
            type="text"
            data-testid="transfer-amount-input"
            value={amount}
            onChange={(e) => onAmountChange(formatCurrency(e.target.value))}
            placeholder="0"
            className="w-full rounded-lg border border-border bg-card px-10 py-3 text-lg font-semibold text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Hold Period */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Periode Hold</label>
        <p className="text-xs text-muted-foreground mb-2">
          Funds will be held during this period before being auto-released to the recipient. You may
          release earlier if needed.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onHoldDaysChange(7)}
            className={`rounded-lg border p-3 text-center transition ${
              holdDays === 7
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary"
            }`}
          >
            <div className="text-lg font-bold">7 Hari</div>
            <div className="text-xs opacity-70">Rekomendasi</div>
          </button>
          <button
            type="button"
            onClick={() => onHoldDaysChange(30)}
            className={`rounded-lg border p-3 text-center transition ${
              holdDays === 30
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary"
            }`}
          >
            <div className="text-lg font-bold">30 Hari</div>
            <div className="text-xs opacity-70">Large Transaction</div>
          </button>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Deskripsi (Opsional)
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Contoh: Pembayaran untuk jasa desain logo"
          rows={2}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
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
          type="button"
          onClick={onNext}
          className="flex-1 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Lanjutkan
        </button>
      </div>
    </div>
  );
}
