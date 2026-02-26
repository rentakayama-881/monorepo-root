"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SectionLoadingBlock } from "@/components/ui/LoadingState";
import { fetchJsonAuth } from "@/lib/api";

const FINAL_STATUSES = new Set(["fulfilled", "failed"]);

function normalizeFailure(message) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("context canceled")) {
    return "Permintaan melebihi batas waktu. Silakan coba lagi.";
  }
  if (lower.includes("saldo kamu tidak mencukupi") || lower.includes("saldo wallet anda tidak mencukupi") || lower.includes("insufficient")) {
    return "Saldo wallet Anda belum mencukupi.";
  }
  if (
    lower.includes("akun belum siap") ||
    lower.includes("item not found") ||
    lower.includes("current listing") ||
    lower.includes("sold") ||
    lower.includes("removed by the site administration") ||
    lower.includes("currently unavailable") ||
    lower.includes("account validation")
  ) {
    return "Akun saat ini belum tersedia untuk dibeli.";
  }
  if (lower.includes("checker") || lower.includes("retry_request")) {
    return "Sistem verifikasi sedang sibuk. Silakan coba lagi dalam beberapa saat.";
  }
  return raw || "Terjadi kendala sementara pada proses pembelian.";
}

function getStepLabel(step) {
  const code = String(step?.code || "").toUpperCase();
  const map = {
    INIT: "Pesanan dibuat",
    PROCESSING: "Memulai proses pembelian",
    USER_BALANCE_CHECK: "Memeriksa saldo wallet",
    USER_BALANCE_RESERVE: "Mengunci saldo pembayaran",
    PURCHASE_WORKFLOW: "Menjalankan alur pembelian otomatis",
    PLATFORM_READINESS_CHECK: "Memverifikasi kesiapan sistem penjualan",
    PLATFORM_READINESS_DEFERRED: "Melanjutkan proses pada verifikasi lanjutan",
    ITEM_AVAILABILITY_CHECK: "Memverifikasi ketersediaan akun",
    PURCHASE_EXECUTION: "Menjalankan pembelian",
    USER_BALANCE_CAPTURE: "Menyelesaikan pembayaran",
    DELIVERY_READY: "Data akun siap diberikan",

    // Backward compatibility for older orders.
    PROVIDER_DIRECT_BUY_FLOW: "Menjalankan alur pembelian otomatis",
    SUPPLIER_BALANCE_CHECK: "Memverifikasi kesiapan sistem penjualan",
    SUPPLIER_BALANCE_UNKNOWN_CONTINUE: "Melanjutkan proses pada verifikasi lanjutan",
    FETCH_PROVIDER_ITEM: "Memverifikasi ketersediaan akun",
    PROVIDER_PURCHASE: "Menjalankan pembelian",
  };
  return map[code] || step?.label || "Memproses";
}

function getStatusText(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "fulfilled") return "Selesai";
  if (normalized === "failed") return "Gagal";
  return "Diproses";
}

function getCurrentStep(order) {
  const steps = Array.isArray(order?.steps) ? order.steps : [];
  if (steps.length === 0) return null;
  return steps[steps.length - 1];
}

function normalizeSubscription(order) {
  const raw = String(order?.delivery?.account?.subscription || order?.title || "").trim();
  if (!raw) return "-";
  return raw.replace(/plan$/i, "");
}

export default function MarketChatGPTOrderDetailPage() {
  const params = useParams();
  const orderID = String(params?.orderId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let timer = null;
    let lastKnownStatus = "";

    const scheduleRetry = (delayMs = 1800) => {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadOrder(false), delayMs);
    };

    async function loadOrder(isFirst = false) {
      if (!orderID) return;
      if (isFirst) {
        setLoading(true);
      }
      try {
        const data = await fetchJsonAuth(`/api/market/chatgpt/orders/${encodeURIComponent(orderID)}?ts=${Date.now()}`, {
          method: "GET",
          timeout: 20000,
          cache: "no-store",
        });
        if (!active) return;
        setError("");

        const nextOrder = data?.order || null;
        setOrder(nextOrder);

        const status = String(nextOrder?.status || "").toLowerCase();
        lastKnownStatus = status;

        if (nextOrder && !FINAL_STATUSES.has(status)) {
          setProgressModalOpen(true);
          scheduleRetry(1800);
        }

        if (status === "failed") {
          setProgressModalOpen(true);
        }
        if (status === "fulfilled") {
          setProgressModalOpen(false);
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Gagal memuat detail pembelian.");
        if (!FINAL_STATUSES.has(lastKnownStatus)) {
          scheduleRetry(3000);
        }
      } finally {
        if (active && isFirst) {
          setLoading(false);
          setManualRefresh(false);
        }
      }
    }

    loadOrder(true);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderID, refreshNonce]);

  const statusText = useMemo(() => getStatusText(order?.status), [order?.status]);
  const currentStep = useMemo(() => getCurrentStep(order), [order]);
  const statusNormalized = String(order?.status || "").toLowerCase();
  const isProcessing = order ? !FINAL_STATUSES.has(statusNormalized) : false;

  return (
    <main className="container py-10 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketplace</div>
        <h1 className="text-2xl font-semibold text-foreground">Detail Pembelian</h1>
        <p className="text-sm text-muted-foreground">Ringkasan status dan data akun yang berhasil dibeli.</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        {loading ? <SectionLoadingBlock lines={4} compact srLabel="Memuat detail pembelian" /> : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}

        {!loading && !error && !order ? <p className="text-sm text-muted-foreground">Data pembelian tidak ditemukan.</p> : null}

        {!loading && !error && order ? (
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
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status Proses</div>
                  <div className="mt-1 text-sm text-foreground">{currentStep ? getStepLabel(currentStep) : "Menunggu pembaruan status..."}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Terakhir diperbarui: {formatDateTime(currentStep?.at)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setProgressModalOpen(true)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                >
                  Lihat Detail Proses
                </button>
              </div>

              {isProcessing ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                  Selama proses berjalan, mohon jangan menutup atau me-refresh halaman ini.
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data Akun</div>
              {statusNormalized === "fulfilled" ? (
                <div className="mt-3 space-y-3">
                  <CredentialBlock
                    title="Ringkasan Akun"
                    rows={[
                      ["Subscription", normalizeSubscription(order)],
                      ["Status", order?.delivery?.account?.status],
                      ["Tier", order?.delivery?.account?.openai_tier],
                      ["Negara", order?.delivery?.account?.country],
                      ["Domain Email", order?.delivery?.account?.email_domain],
                      ["Penjual", order?.seller || order?.delivery?.account?.seller],
                    ]}
                  />

                  <CredentialBlock
                    title="Login Akun"
                    rows={[
                      ["Email/Username", order?.delivery?.credentials?.account_login],
                      ["Password", order?.delivery?.credentials?.account_password],
                    ]}
                  />

                  <CredentialBlock
                    title="Login Email"
                    rows={[
                      ["Email", order?.delivery?.credentials?.email_login],
                      ["Password", order?.delivery?.credentials?.email_password],
                    ]}
                  />

                  <LinkBlock
                    title="Tautan Login"
                    rows={[
                      ["Login Akun", order?.delivery?.account?.account_login_url],
                      ["Login Email", order?.delivery?.account?.email_login_url],
                    ]}
                  />

                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                    Demi keamanan, segera ubah password akun utama dan email pemulihan setelah pembelian selesai.
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Data akun akan ditampilkan setelah transaksi selesai.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/market/chatgpt" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
          Kembali ke daftar akun
        </Link>
        <Link href="/account/my-purchases" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
          Buka Riwayat Pembelian
        </Link>
        <button
          type="button"
          onClick={() => {
            setManualRefresh(true);
            setRefreshNonce((v) => v + 1);
          }}
          disabled={loading || manualRefresh || isProcessing}
          className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {manualRefresh ? "Memuat ulang..." : "Muat Ulang Status"}
        </button>
      </div>

      <ProgressModal
        open={progressModalOpen}
        lock={isProcessing}
        order={order}
        onClose={() => setProgressModalOpen(false)}
      />
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground break-all">{value || "-"}</div>
    </div>
  );
}

function ProgressModal({ open, lock, order, onClose }) {
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
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Progress Pembelian</div>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {status === "failed" ? "Pembelian Gagal" : status === "fulfilled" ? "Pembelian Selesai" : "Pembelian Sedang Diproses"}
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
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{failureMessage}</div>
          ) : null}

          <div className="mt-3 max-h-[48vh] space-y-2 overflow-auto pr-1">
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Menunggu pembaruan status...</p>
            ) : (
              steps.map((step, idx) => (
                <div key={`${step?.code || "step"}-${idx}`} className="rounded-md border border-border bg-background p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-foreground">{getStepLabel(step)}</div>
                    <StepBadge status={step?.status} />
                  </div>
                  {step?.message ? <div className="mt-1 text-xs text-muted-foreground">{normalizeFailure(step.message)}</div> : null}
                  <div className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(step?.at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StepBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") {
    return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">Selesai</span>;
  }
  if (normalized === "failed") {
    return <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">Gagal</span>;
  }
  return <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">Diproses</span>;
}

function CredentialBlock({ title, rows }) {
  const hasValue = rows.some((row) => String(row?.[1] || "").trim() !== "");
  if (!hasValue) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[160px,1fr]">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm text-foreground break-all">{value || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkBlock({ title, rows }) {
  const validRows = rows.filter((row) => {
    const url = String(row?.[1] || "").trim();
    return /^https?:\/\//i.test(url);
  });

  if (validRows.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {validRows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[160px,1fr]">
            <div className="text-xs text-muted-foreground">{label}</div>
            <a href={value} target="_blank" rel="noreferrer" className="text-sm break-all text-primary underline underline-offset-2">
              {value}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "-";
  }
}
