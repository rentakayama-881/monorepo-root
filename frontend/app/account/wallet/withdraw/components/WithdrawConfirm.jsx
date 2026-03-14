export default function WithdrawConfirm({
  cryptoCurrency,
  network,
  cryptoAddress,
  memo,
  parsedAmount,
  fee,
  totalDeduction,
  pin,
  setPin,
  processing,
  handleWithdraw,
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Konfirmasi Penarikan</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mata uang</span>
            <span className="font-medium">
              {cryptoCurrency}
              {network ? ` (${network})` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Alamat tujuan</span>
            <span className="font-mono text-xs max-w-[200px] truncate">{cryptoAddress}</span>
          </div>
          {memo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Memo</span>
              <span className="font-mono text-xs">{memo}</span>
            </div>
          )}
          <hr className="border-border" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jumlah penarikan</span>
            <span>Rp{parsedAmount.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Biaya layanan</span>
            <span>Rp{fee.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total dipotong</span>
            <span>Rp{totalDeduction.toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Masukkan PIN Wallet
        </label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          className="h-14 w-full rounded-lg border border-input bg-background px-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground text-center">
          Masukkan 6 digit PIN wallet Anda
        </p>
      </div>

      <button
        disabled={pin.length !== 6 || processing}
        onClick={handleWithdraw}
        className="h-12 w-full rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? "Memproses..." : "Konfirmasi Penarikan"}
      </button>
    </div>
  );
}
