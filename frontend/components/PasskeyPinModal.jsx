export default function PasskeyPinModal({
  pin,
  onPinChange,
  pinError,
  registering,
  onConfirm,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-bold text-foreground">Konfirmasi PIN</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Masukkan PIN transaksi untuk melanjutkan pendaftaran passkey.
        </p>

        <div className="mt-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => onPinChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-primary"
            autoFocus
          />
        </div>

        {pinError && <p className="mt-2 text-sm text-destructive">{pinError}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={registering}
            className="flex-1 rounded-md border border-border py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={registering || pin.length !== 6}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {registering ? "Memverifikasi..." : "Verifikasi PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
