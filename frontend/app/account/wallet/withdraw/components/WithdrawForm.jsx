import { quickAmounts, feePercent } from "../useWithdraw";

export default function WithdrawForm({
  step,
  cryptoCurrency,
  setCryptoCurrency,
  network,
  setNetwork,
  cryptoAddress,
  setCryptoAddress,
  memo,
  setMemo,
  amount,
  parsedAmount,
  fee,
  totalDeduction,
  wallet,
  availableNetworks,
  cryptoCurrencies,
  isStep1Valid,
  isStep2Valid,
  handleAmountChange,
  handleQuickAmount,
  goNext,
}) {
  if (step === 1) {
    return (
      <div className="space-y-5">
        {/* Crypto Selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Pilih Mata Uang</label>
          <div className="grid grid-cols-2 gap-3">
            {cryptoCurrencies.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCryptoCurrency(c.value)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all ${
                  cryptoCurrency === c.value
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableNetworks.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNetwork(n)}
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

        {/* Address Input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Alamat Wallet Tujuan
          </label>
          <input
            type="text"
            value={cryptoAddress}
            onChange={(e) => setCryptoAddress(e.target.value.trim())}
            placeholder="Masukkan alamat wallet"
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {cryptoAddress && cryptoAddress.length < 10 && (
            <p className="mt-1 text-xs text-destructive">Alamat wallet terlalu pendek</p>
          )}
        </div>

        {/* Memo for TON */}
        {(cryptoCurrency === "TON" || network === "TON") && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Memo <span className="text-muted-foreground">(opsional)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Memo jika diperlukan"
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        <div className="rounded-lg border border-status-amber-border bg-status-amber-bg p-3">
          <p className="text-xs text-status-amber-text">
            ⚠️ Pastikan alamat dan jaringan sudah benar. Pengiriman ke alamat atau jaringan yang
            salah tidak dapat dikembalikan.
          </p>
        </div>

        <button
          disabled={!isStep1Valid}
          onClick={goNext}
          className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Lanjutkan
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">Tujuan</div>
          <div className="text-sm font-mono font-medium truncate">{cryptoAddress}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {cryptoCurrency}
            {network ? ` • ${network}` : ""}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Jumlah Penarikan
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickAmounts.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAmount(val)}
                className="rounded-sm border border-input px-3 py-2 text-xs hover:bg-accent transition-colors min-h-[44px]"
              >
                {(val / 1000).toLocaleString("id-ID")}rb
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const maxAmount = Math.floor(wallet.balance / (1 + feePercent));
                if (maxAmount > 0) handleQuickAmount(maxAmount);
              }}
              className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors min-h-[44px]"
            >
              Maks
            </button>
          </div>
        </div>

        {parsedAmount > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jumlah penarikan</span>
              <span>Rp{parsedAmount.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Biaya layanan (2%)</span>
              <span>Rp{fee.toLocaleString("id-ID")}</span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between text-sm font-semibold">
              <span>Total dipotong dari saldo</span>
              <span>Rp{totalDeduction.toLocaleString("id-ID")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Rp{parsedAmount.toLocaleString("id-ID")} akan dikonversi ke {cryptoCurrency} dan
              dikirim ke alamat tujuan
            </p>
          </div>
        )}

        {parsedAmount > 0 && parsedAmount < quickAmounts[0] && (
          <div className="rounded-lg bg-status-amber-bg border border-status-amber-border p-3 text-sm text-status-amber-text">
            Minimal penarikan Rp{quickAmounts[0].toLocaleString("id-ID")}
          </div>
        )}

        {parsedAmount >= quickAmounts[0] && totalDeduction > wallet.balance && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            Saldo tidak cukup. Diperlukan Rp{totalDeduction.toLocaleString("id-ID")} (termasuk fee
            2% Rp{fee.toLocaleString("id-ID")}). Saldo Anda: Rp
            {wallet.balance.toLocaleString("id-ID")}
          </div>
        )}

        <button
          disabled={!isStep2Valid}
          onClick={goNext}
          className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Lanjutkan
        </button>
      </div>
    );
  }

  return null;
}
