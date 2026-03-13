import Portal from "@/components/ui/Portal";

export function CheckoutConfirmModal({ item, countdown, onCancel, onConfirm, disabled }) {
  if (!item) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[120] bg-black/55" />
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi pembelian"
          className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl"
        >
          <h2 className="text-base font-semibold text-foreground">Konfirmasi Pembelian</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Anda akan membeli akun <span className="font-medium text-foreground">{item.title}</span>{" "}
            dengan harga
            <span className="font-medium text-foreground"> {item.displayPriceIDR}</span>.
          </p>
          <p className="mt-2 text-xs text-warning-foreground">
            Untuk mencegah pembelian tidak sengaja, tombol konfirmasi akan aktif setelah hitung
            mundur selesai.
          </p>
          {item.seller !== "-" ? (
            <p className="mt-1 text-xs text-muted-foreground">Penjual: {item.seller}</p>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {countdown > 0 ? `Ya, beli (${countdown} dtk)` : "Ya, beli sekarang"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export function CheckoutBlockingModal({ message }) {
  if (!message) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[160] bg-black/60" />
      <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Proses pembelian"
          className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="size-5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            <span className="text-sm font-semibold text-foreground">
              Proses pembelian sedang berjalan
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <p className="mt-2 text-xs text-warning-foreground">
            Mohon jangan menutup atau me-refresh halaman hingga proses selesai.
          </p>
        </div>
      </div>
    </Portal>
  );
}

export function CheckoutFeedbackModal({ feedback, onClose, onRefresh, refreshing }) {
  if (!feedback) return null;

  const isWarning = feedback.variant === "warning";

  return (
    <Portal>
      <div data-testid="checkout-feedback-overlay" className="fixed inset-0 z-[180] bg-black/50" />
      <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hasil pembelian"
          className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
        >
          <div
            className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
              isWarning
                ? "bg-warning/10 text-warning-foreground"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {feedback.message}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {refreshing ? "Memuat ulang..." : "Muat ulang daftar"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
