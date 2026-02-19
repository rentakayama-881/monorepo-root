"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/api";

function extractList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload.items,
    payload.accounts,
    payload.data,
    payload.result,
    payload.chatgpt,
    payload.rows,
    payload.list,
  ];
  for (const item of candidates) {
    if (Array.isArray(item)) return item;
    if (item && typeof item === "object" && Array.isArray(item.items)) return item.items;
  }
  return [];
}

function toDisplayAccount(item, index) {
  const id = item?.id ?? item?.item_id ?? item?.account_id ?? `row-${index}`;
  return {
    id: String(id),
    title: item?.title ?? item?.name ?? item?.account_title ?? item?.description ?? `Account ${index + 1}`,
    price: item?.price ?? item?.amount ?? item?.cost ?? "-",
    status: item?.status ?? item?.state ?? item?.availability ?? "-",
    seller: item?.seller ?? item?.seller_name ?? item?.owner ?? "-",
    raw: item,
  };
}

export default function MarketChatGPTClient() {
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);

  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${apiBase}/api/market/chatgpt?i18n=en-US`, {
          method: "GET",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat listing market.");
        if (!cancelled) setResponse(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Gagal memuat listing market.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const accounts = useMemo(() => {
    const list = extractList(response?.json);
    return list.map(toDisplayAccount);
  }, [response]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((item) =>
      `${item.title} ${item.price} ${item.status} ${item.seller}`.toLowerCase().includes(term)
    );
  }, [accounts, query]);

  async function handleCheckout(itemID) {
    setCheckingOut(itemID);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/market/chatgpt/${encodeURIComponent(itemID)}/checkout`, {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuat checkout URL.");
      const checkoutURL = data?.checkout_url;
      if (!checkoutURL) throw new Error("Checkout URL tidak tersedia.");
      window.open(checkoutURL, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err?.message || "Gagal lanjut checkout.");
    } finally {
      setCheckingOut("");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Marketplace
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">ChatGPT Accounts</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Listing ditarik dari partner market API. Pembelian dilakukan lewat tautan checkout resmi agar alur transaksi tetap aman.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {loading ? "Memuat listing..." : `${filtered.length} item tersedia`}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari title, status, seller..."
            className="w-full sm:w-80 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada item yang cocok.</p>
        ) : (
          <div className="overflow-auto rounded-md border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Price</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Seller</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2">{item.title}</td>
                    <td className="px-3 py-2">{String(item.price)}</td>
                    <td className="px-3 py-2">{String(item.status)}</td>
                    <td className="px-3 py-2">{String(item.seller)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleCheckout(item.id)}
                        disabled={checkingOut === item.id}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        {checkingOut === item.id ? "Membuka..." : "Beli"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
