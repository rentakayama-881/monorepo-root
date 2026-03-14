import { useEffect } from "react";
import { formatDateTime } from "@/lib/format";
import { normalizeFailure, getStepLabel } from "../useOrderDetail";

function StepBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") {
    return (
      <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">
        Selesai
      </span>
    );
  }
  if (normalized === "failed") {
    return (
      <span className="rounded-sm border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
        Gagal
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">
      Diproses
    </span>
  );
}

export default function OrderTimeline({ open, lock, order, onClose }) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !order) return null;

  const status = String(order?.status || "").toLowerCase();
  const steps = Array.isArray(order?.steps) ? order.steps : [];
  const failureMessage = normalizeFailure(order?.failure_reason || "");

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/55" />
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Progress Pembelian
              </div>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {status === "failed"
                  ? "Pembelian Gagal"
                  : status === "fulfilled"
                    ? "Pembelian Selesai"
                    : "Pembelian Sedang Diproses"}
              </h2>
            </div>
            {!lock ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted/40"
              >
                Tutup
              </button>
            ) : null}
          </div>

          {lock ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Proses masih berjalan. Mohon jangan menutup atau me-refresh halaman.
            </div>
          ) : null}

          {status === "failed" ? (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {failureMessage}
            </div>
          ) : null}

          <div className="mt-3 max-h-[48vh] space-y-2 overflow-auto pr-1">
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Menunggu pembaruan status...</p>
            ) : (
              steps.map((step, idx) => (
                <div
                  key={`${step?.code || "step"}-${idx}`}
                  className="rounded-md border border-border bg-background p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-foreground">{getStepLabel(step)}</div>
                    <StepBadge status={step?.status} />
                  </div>
                  {step?.message ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {normalizeFailure(step.message)}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(step?.at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
