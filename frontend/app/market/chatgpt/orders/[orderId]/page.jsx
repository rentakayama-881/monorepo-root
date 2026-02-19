"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";

export default function MarketChatGPTOrderDetailPage() {
  const params = useParams();
  const orderID = String(params?.orderId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      if (!orderID) return;
      setLoading(true);
      setError("");
      try {
        const data = await fetchJsonAuth(`/api/market/chatgpt/orders/${encodeURIComponent(orderID)}`, {
          method: "GET",
        });
        if (!cancelled) setOrder(data?.order || null);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Gagal memuat detail order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderID]);

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
              <Row label="Title" value={order?.title} />
              <Row label="Price" value={String(order?.price ?? "-")} />
              <Row label="Status" value={order?.status || "-"} />
              <Row label="Seller" value={order?.seller || "-"} />
            </div>

            {order?.failure_reason ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {order.failure_reason}
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data Akun</div>
              {order?.status === "fulfilled" ? (
                <div className="mt-3 space-y-3">
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
                  <details className="rounded-md border border-border bg-card p-2">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Lihat response mentah</summary>
                    <pre className="mt-2 max-h-[320px] overflow-auto text-xs text-foreground">
                      {JSON.stringify(order?.delivery ?? {}, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Data akun akan muncul setelah order berstatus fulfilled.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <Link href="/market/chatgpt" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
        Kembali ke listing
      </Link>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value || "-"}</div>
    </div>
  );
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
