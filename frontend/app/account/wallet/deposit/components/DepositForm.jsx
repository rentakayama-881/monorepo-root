import { CRYPTO_OPTIONS, quickAmounts, minDeposit } from "../deposit-utils";

export default function DepositForm({
  payCurrency,
  onPayCurrencyChange,
  network,
  onNetworkChange,
  availableNetworks,
  amount,
  onAmountChange,
  onQuickAmount,
  parsedAmount,
  platformFee,
  totalCharge,
  processing,
  onSubmit,
}) {
  return (
    <div className="space-y-5">
      {/* Crypto Selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Pilih Mata Uang</label>
        <div className="grid grid-cols-2 gap-3">
          {CRYPTO_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onPayCurrencyChange(c.value)}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all ${
                payCurrency === c.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              {c.icon}
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">{c.symbol}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Network Selector */}
      {availableNetworks.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Pilih Jaringan</label>
          <div className="grid grid-cols-3 gap-2">
            {availableNetworks.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onNetworkChange(n)}
                className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                  network === n
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount Input */}
      <div>
        <label
          htmlFor="deposit-amount"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Jumlah Deposit
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            Rp
          </span>
          <input
            id="deposit-amount"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={onAmountChange}
            placeholder="0"
            className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {quickAmounts.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onQuickAmount(val)}
              className="rounded-sm border border-input px-3 py-1 text-xs hover:bg-accent transition-colors"
            >
              {(val / 1000).toLocaleString("id-ID")}rb
            </button>
          ))}
        </div>
      </div>

      {/* Fee Summary */}
      {parsedAmount >= minDeposit && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Jumlah deposit</span>
            <span>Rp{parsedAmount.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Biaya layanan</span>
            <span>Rp{platformFee.toLocaleString("id-ID")}</span>
          </div>
          <hr className="border-border" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total pembayaran</span>
            <span>Rp{totalCharge.toLocaleString("id-ID")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Total akan dikonversi ke {payCurrency} dengan kurs saat pembayaran. Biaya jaringan
            blockchain sudah termasuk dalam jumlah kripto yang ditampilkan.
          </p>
        </div>
      )}

      <button
        disabled={parsedAmount < minDeposit || processing || !network}
        onClick={onSubmit}
        className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? "Memproses..." : "Lanjutkan"}
      </button>
    </div>
  );
}
