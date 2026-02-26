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
    return "Request timed out while checking account availability. Please try again.";
  }
  if (lower.includes("saldo kamu tidak mencukupi") || lower.includes("insufficient")) return "Your balance is insufficient.";
  if (lower.includes("akun belum siap")) return "This account is currently unavailable.";
  if (lower.includes("item not found") || lower.includes("current listing") || lower.includes("sold")) {
    return "This account is currently unavailable.";
  }
  if (lower.includes("more than 20 errors occurred during account validation") || lower.includes("account validation")) {
    return "This account is currently unavailable.";
  }
  if (lower.includes("checker")) return "Verification is currently in progress. Please try again shortly.";
  if (
    lower.includes("provider") ||
    lower.includes("supplier") ||
    lower.includes("feature wallet") ||
    lower.includes("internal") ||
    lower.includes("transport")
  ) {
    return "A temporary system issue occurred. Please try again shortly.";
  }
  return raw || "A temporary system issue occurred. Please try again shortly.";
}

function getStepLabel(step) {
  const code = String(step?.code || "").toUpperCase();
  const map = {
    INIT: "Order created",
    PROCESSING: "Processing order",
    USER_BALANCE_CHECK: "Checking account balance",
    FETCH_PROVIDER_ITEM: "Validating account availability",
    USER_BALANCE_RESERVE: "Reserving payment amount",
    SUPPLIER_BALANCE_CHECK: "Verifying account readiness",
    PROVIDER_PURCHASE: "Executing purchase",
    USER_BALANCE_CAPTURE: "Finalizing payment",
    DELIVERY_READY: "Account data is ready",
  };
  return map[code] || step?.label || "Processing";
}

export default function MarketChatGPTOrderDetailPage() {
  const params = useParams();
  const orderID = String(params?.orderId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [manualRefresh, setManualRefresh] = useState(false);

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
          scheduleRetry(1800);
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load order details.");
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

  const statusText = useMemo(() => {
    const status = String(order?.status || "").toLowerCase();
    if (status === "fulfilled") return "Completed";
    if (status === "failed") return "Failed";
    return "Processing";
  }, [order?.status]);

  return (
    <main className="container py-10 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketplace</div>
        <h1 className="text-2xl font-semibold text-foreground">Order Details</h1>
        <p className="text-sm text-muted-foreground">Order ID: {orderID || "-"}</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        {loading ? <SectionLoadingBlock lines={4} compact srLabel="Loading order details" /> : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}

        {!loading && !error && !order ? <p className="text-sm text-muted-foreground">Order not found.</p> : null}

        {!loading && !error && order ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Product" value={order?.title} />
              <Row label="Price" value={order?.price_display || order?.price || "-"} />
              <Row label="Status" value={statusText} />
              <Row label="Order ID" value={order?.id || "-"} />
            </div>

            {order?.failure_reason ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {normalizeFailure(order.failure_reason)}
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Purchase Progress</div>
              <div className="mt-3 space-y-2">
                {(order?.steps || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Waiting for status updates...</p>
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
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Account Data</div>
              {order?.status === "fulfilled" ? (
                <div className="mt-3 space-y-3">
                  <CredentialBlock
                    title="Account Summary"
                    rows={[
                      ["Title", order?.delivery?.account?.title],
                      ["Status", order?.delivery?.account?.status],
                      ["Tier", order?.delivery?.account?.openai_tier],
                      ["Subscription", order?.delivery?.account?.subscription],
                      ["Country", order?.delivery?.account?.country],
                      ["Email Domain", order?.delivery?.account?.email_domain],
                    ]}
                  />
                  <CredentialBlock
                    title="Account Login"
                    rows={[
                      ["Email/Username", order?.delivery?.credentials?.account_login],
                      ["Password", order?.delivery?.credentials?.account_password],
                    ]}
                  />
                  <CredentialBlock
                    title="Recovery Email Login"
                    rows={[
                      ["Email", order?.delivery?.credentials?.email_login],
                      ["Password", order?.delivery?.credentials?.email_password],
                    ]}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Account data will appear after the order is completed.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/market/chatgpt" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
          Back to listings
        </Link>
        <Link href="/account/my-purchases" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
          Open My Purchases
        </Link>
        <button
          type="button"
          onClick={() => {
            setManualRefresh(true);
            setRefreshNonce((v) => v + 1);
          }}
          disabled={loading || manualRefresh}
          className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {manualRefresh ? "Refreshing..." : "Refresh status"}
        </button>
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
    return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">Done</span>;
  }
  if (normalized === "failed") {
    return <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">Failed</span>;
  }
  return <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">Processing</span>;
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
    return new Date(value).toLocaleString("en-US", {
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
