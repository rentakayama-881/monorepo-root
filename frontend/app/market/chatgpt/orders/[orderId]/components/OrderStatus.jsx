import { formatDateTime } from "@/lib/format";
import { normalizeFailure, normalizeSubscription, getStepLabel } from "../useOrderDetail";

function Row({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground break-all">{value || "-"}</div>
    </div>
  );
}

export default function OrderStatus({
  order,
  statusText,
  statusNormalized,
  currentStep,
  isProcessing,
  onShowProgress,
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Langganan" value={normalizeSubscription(order)} />
        <Row label="Harga" value={order?.price_display || order?.price || "-"} />
        <Row label="Status" value={statusText} />
        <Row label="Penjual" value={order?.seller || order?.delivery?.account?.seller || "-"} />
      </div>

      {statusNormalized === "failed" && order?.failure_reason ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {normalizeFailure(order.failure_reason)}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-background p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Status Proses
            </div>
            <div className="mt-1 text-sm text-foreground">
              {currentStep ? getStepLabel(currentStep) : "Menunggu pembaruan status..."}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Terakhir diperbarui: {formatDateTime(currentStep?.at)}
            </div>
          </div>
          <button
            type="button"
            onClick={onShowProgress}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
          >
            Lihat Detail Proses
          </button>
        </div>

        {isProcessing ? (
          <div className="rounded-md border border-status-amber-border bg-status-amber-bg px-3 py-2 text-xs text-status-amber-text">
            Selama proses berjalan, mohon jangan menutup atau me-refresh halaman ini.
          </div>
        ) : null}
      </div>
    </div>
  );
}
