"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { SectionLoadingBlock } from "@/components/ui/LoadingState";

const FINAL_STATUSES = new Set(["fulfilled", "failed"]);

export default function MyPurchasesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let active = true;
    let timer = null;

    async function load(isFirst = false) {
      if (isFirst) setLoading(true);
      setError("");
      try {
        const data = await fetchJsonAuth("/api/market/chatgpt/orders", { method: "GET" });
        if (!active) return;
        const nextOrders = Array.isArray(data?.orders) ? data.orders : [];
        setOrders(nextOrders);

        const stillProcessing = nextOrders.some((order) => !FINAL_STATUSES.has(String(order?.status || "").toLowerCase()));
        if (stillProcessing) {
          timer = setTimeout(() => load(false), 2200);
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load purchase history.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load(true);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

  return (
    <main className="container py-8 space-y-4">
      <header className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account</div>
        <h1 className="text-2xl font-semibold text-foreground">Riwayat Pembelian</h1>
        <p className="text-sm text-muted-foreground">Halaman ini menampilkan akun yang pembeliannya sudah berhasil.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-3">
        {loading ? <SectionLoadingBlock lines={3} compact /> : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && !hasOrders ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pembelian yang selesai.</p>
            <Link href="/market/chatgpt" className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
              Buka Marketplace
            </Link>
          </div>
        ) : null}

        {!loading && !error && hasOrders ? (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/35">
                <tr>
                  <th className="px-2.5 py-2 text-left font-medium">Produk</th>
                  <th className="px-2.5 py-2 text-left font-medium">Harga</th>
                  <th className="px-2.5 py-2 text-left font-medium">Status</th>
                  <th className="px-2.5 py-2 text-left font-medium">Waktu</th>
                  <th className="px-2.5 py-2 text-left font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order?.id} className="border-t border-border">
                    <td className="px-2.5 py-2">
                      <div className="max-w-[360px] truncate font-medium">{order?.title || "ChatGPT Account"}</div>
                      {String(order?.pricing_note || "").toLowerCase().includes("dipulihkan") ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">Riwayat lama (detail terbatas)</div>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-2 font-medium">{order?.price_display || order?.price || "-"}</td>
                    <td className="px-2.5 py-2">
                      <StatusBadge status={order?.status} />
                    </td>
                    <td className="px-2.5 py-2 text-muted-foreground">{formatDateTime(order?.created_at)}</td>
                    <td className="px-2.5 py-2">
                      <Link
                        href={`/market/chatgpt/orders/${encodeURIComponent(order?.id || "")}`}
                        className="inline-flex rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
                      >
                        Lihat Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "fulfilled") {
    return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">Selesai</span>;
  }
  if (normalized === "failed") {
    return <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">Gagal</span>;
  }
  return <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">Diproses</span>;
}
