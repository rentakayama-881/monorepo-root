"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { fetchJsonAuth } from "@/lib/api";

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
  const seller =
    typeof item?.seller === "object" && item?.seller !== null
      ? item?.seller?.username ?? item?.seller?.title ?? item?.seller?.name ?? item?.seller?.id ?? "-"
      : item?.seller ?? item?.seller_name ?? item?.owner ?? "-";

  return {
    id: String(id),
    title: item?.title ?? item?.name ?? item?.account_title ?? item?.description ?? `Account ${index + 1}`,
    price: item?.priceWithSellerFee ?? item?.price ?? item?.amount ?? item?.cost ?? "-",
    status: item?.item_state ?? item?.status ?? item?.state ?? item?.availability ?? "-",
    seller,
    canBuy:
      typeof item?.canBuyItem === "boolean"
        ? item.canBuyItem
        : item?.canBuyItem === 1 || item?.canBuyItem === "1" || item?.canBuyItem === "true",
    raw: item,
  };
}

async function parseApiResponseSafe(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  const text = await res.text().catch(() => "");
  return { error: text || `HTTP ${res.status}` };
}

export default function MarketChatGPTClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState("");
  const [expandedID, setExpandedID] = useState("");
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
        const data = await parseApiResponseSafe(res);
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

  async function handleCheckout(itemID, canBuy) {
    if (!canBuy) {
      setError("Item ini belum bisa dibeli saat ini.");
      return;
    }
    setCheckingOut(itemID);
    setError("");
    try {
      const data = await fetchJsonAuth("/api/market/chatgpt/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item_id: itemID, i18n: "en-US" }),
      });
      const orderID = data?.order?.id;
      if (!orderID) throw new Error("Order berhasil dibuat tetapi ID order tidak ditemukan.");
      router.push(`/market/chatgpt/orders/${encodeURIComponent(orderID)}`);
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
          Pilih akun yang tersedia lalu checkout langsung di web ini. Data akun akan dikirim ke detail order setelah pembelian sukses.
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
                  <Fragment key={item.id}>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2">{item.title}</td>
                      <td className="px-3 py-2">{String(item.price)}</td>
                      <td className="px-3 py-2">{String(item.status)}</td>
                      <td className="px-3 py-2">{String(item.seller)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedID(expandedID === item.id ? "" : item.id)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                          >
                            {expandedID === item.id ? "Tutup Detail" : "Detail"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckout(item.id, item.canBuy)}
                            disabled={checkingOut === item.id || !item.canBuy}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                          >
                            {checkingOut === item.id ? "Memproses..." : item.canBuy ? "Beli" : "Tidak Tersedia"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedID === item.id ? (
                      <tr className="border-t border-border bg-muted/20">
                        <td colSpan={5} className="px-3 py-3">
                          <AccountSpecs item={item.raw} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountSpecs({ item }) {
  const specs = [
    ["Subscription", item?.chatgpt_subscription],
    ["Subscription Ends", formatUnixDate(item?.chatgpt_subscription_ends)],
    ["Auto Renewal", booleanLabel(item?.chatgpt_subscription_auto_renew)],
    ["Country", item?.chatgpt_country],
    ["Register Date", formatUnixDate(item?.chatgpt_register_date)],
    ["Phone Linked", booleanLabel(item?.chatgpt_phone)],
    ["Email Type", item?.email_type],
    ["Email Provider", item?.email_provider],
    ["Email Domain", item?.item_domain],
    ["OpenAI Tier", item?.openai_tier],
    ["OpenAI Balance", item?.openai_balance],
    ["Can Buy", booleanLabel(item?.canBuyItem)],
  ].filter((row) => {
    const value = row?.[1];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });

  if (specs.length === 0) {
    return <p className="text-sm text-muted-foreground">Spesifikasi akun belum tersedia.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {specs.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border bg-card p-2">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="mt-1 text-sm text-foreground break-all">{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function booleanLabel(value) {
  if (value === null || value === undefined) return "";
  if (value === true || value === 1 || value === "1" || value === "true") return "Yes";
  if (value === false || value === 0 || value === "0" || value === "false") return "No";
  return String(value);
}

function formatUnixDate(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  try {
    return new Date(seconds * 1000).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
