"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";

const FINAL_STATUSES = new Set(["fulfilled", "failed"]);

function normalizeFailure(message) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("saldo kamu tidak mencukupi") || lower.includes("insufficient")) return "Saldo kamu tidak mencukupi.";
  if (lower.includes("akun belum siap")) return "Akun belum siap untuk dijual saat ini.";
  if (lower.includes("item not found") || lower.includes("current listing") || lower.includes("sold")) {
    return "Akun belum siap untuk dijual saat ini.";
  }
  if (lower.includes("checker")) return "Sistem sedang memeriksa akun. Coba lagi sebentar.";
  if (
    lower.includes("provider") ||
    lower.includes("supplier") ||
    lower.includes("feature wallet") ||
    lower.includes("internal") ||
    lower.includes("transport")
  ) {
    return "Sedang ada kendala sistem. Coba lagi beberapa saat.";
  }
  return raw || "Sedang ada kendala sistem. Coba lagi beberapa saat.";
}

function getStepLabel(step) {
  const code = String(step?.code || "").toUpperCase();
  const map = {
    INIT: "Pesanan dibuat",
    PROCESSING: "Memproses pesanan",
    USER_BALANCE_CHECK: "Verifikasi saldo akun",
    FETCH_PROVIDER_ITEM: "Validasi ketersediaan akun",
    USER_BALANCE_RESERVE: "Mengunci saldo pesanan",
    SUPPLIER_BALANCE_CHECK: "Validasi stok akun",
    PROVIDER_PURCHASE: "Eksekusi pembelian akun",
    USER_BALANCE_CAPTURE: "Finalisasi pembayaran",
    DELIVERY_READY: "Data akun siap digunakan",
  };
  return map[code] || step?.label || "Proses";
}

export default function MarketChatGPTOrderDetailPage() {
  const params = useParams();
  const orderID = String(params?.orderId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let active = true;
    let timer = null;

    async function loadOrder(isFirst = false) {
      if (!orderID) return;
      if (isFirst) {
        setLoading(true);
      }
      setError("");
      try {
        const data = await fetchJsonAuth(`/api/market/chatgpt/orders/${encodeURIComponent(orderID)}`, {
          method: "GET",
        });
        if (!active) return;
        const nextOrder = data?.order || null;
        setOrder(nextOrder);

        const status = String(nextOrder?.status || "").toLowerCase();
        if (nextOrder && !FINAL_STATUSES.has(status)) {
          timer = setTimeout(() => loadOrder(false), 1800);
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Gagal memuat detail order.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrder(true);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderID]);

  const statusText = useMemo(() => {
    const status = String(order?.status || "").toLowerCase();
    if (status === "fulfilled") return "Selesai";
    if (status === "failed") return "Gagal";
    return "Diproses";
  }, [order?.status]);

  return (
    <main className="container py-10 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketplace</div>
        <h1 className="text-2xl font-semibold text-foreground">Detail Order</h1>
        <p className="text-sm text-muted-foreground">Order ID: {orderID || "-"}</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Memuat detail order...</p> : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}

        {!loading && !error && !order ? <p className="text-sm text-muted-foreground">Order tidak ditemukan.</p> : null}

        {!loading && !error && order ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Produk" value={order?.title} />
              <Row label="Harga" value={order?.price_display || order?.price || "-"} />
              <Row label="Status" value={statusText} />
              <Row label="Order ID" value={order?.id || "-"} />
            </div>

            {order?.failure_reason ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {normalizeFailure(order.failure_reason)}
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Progress Pembelian</div>
              <div className="mt-3 space-y-2">
                {(order?.steps || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Menunggu update proses...</p>
                ) : (
                  order.steps.map((step, idx) => (
                    <div key={`${step?.code || "step"}-${idx}`} className="rounded-md border border-border bg-card p-2.5">
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

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data Akun</div>
              {order?.status === "fulfilled" ? (
                <div className="mt-3 space-y-3">
                  <CredentialBlock
                    title="Ringkasan Akun"
                    rows={[
                      ["Judul", order?.delivery?.account?.title],
                      ["Status", order?.delivery?.account?.status],
                      ["Tier", order?.delivery?.account?.openai_tier],
                      ["Langganan", order?.delivery?.account?.subscription],
                      ["Negara", order?.delivery?.account?.country],
                      ["Domain Email", order?.delivery?.account?.email_domain],
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
                    title="Login Email Recovery"
                    rows={[
                      ["Email", order?.delivery?.credentials?.email_login],
                      ["Password", order?.delivery?.credentials?.email_password],
                    ]}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Data akun akan muncul setelah order berstatus selesai.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/market/chatgpt" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
          Kembali ke listing
        </Link>
        <Link href="/account/my-purchases" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
          Lihat My Purchase
        </Link>
      </div>
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

function StepBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") {
    return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">Selesai</span>;
  }
  if (normalized === "failed") {
    return <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">Gagal</span>;
  }
  return <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">Proses</span>;
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
