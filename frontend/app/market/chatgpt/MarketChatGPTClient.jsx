"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJsonAuth, getApiBase } from "@/lib/api";

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

function normalizeBool(value) {
  if (value === null || value === undefined || value === "") return true;
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return true;
}

function toDisplayAccount(item, index) {
  const id = item?.id ?? item?.item_id ?? item?.account_id ?? item?.chatgpt_item_id ?? `row-${index}`;
  const seller =
    typeof item?.seller === "object" && item?.seller !== null
      ? item?.seller?.username ?? item?.seller?.title ?? item?.seller?.name ?? item?.seller?.id ?? "-"
      : item?.seller ?? item?.seller_name ?? item?.owner ?? "-";

  const numericPriceIDR = Number(item?.price_idr ?? 0);
  const hasIDRPrice = Number.isFinite(numericPriceIDR) && numericPriceIDR > 0;
  const normalizedIDR =
    typeof item?.display_price_idr === "string" && item.display_price_idr.trim() !== ""
      ? item.display_price_idr.trim()
      : hasIDRPrice
      ? `Rp ${numericPriceIDR.toLocaleString("id-ID")}`
      : "Harga belum tersedia";

  return {
    id: String(id),
    title: item?.title ?? item?.name ?? item?.account_title ?? item?.description ?? `Account ${index + 1}`,
    price: item?.priceWithSellerFee ?? item?.price ?? item?.amount ?? item?.cost ?? "-",
    displayPriceIDR: normalizedIDR,
    displayPriceSource: "",
    priceSourceSymbol: item?.price_source_symbol ?? "",
    priceSourceCurrency: item?.price_source_currency ?? "",
    priceIDR: item?.price_idr ?? 0,
    status: item?.item_state ?? item?.status ?? item?.state ?? item?.availability ?? "-",
    seller,
    canBuy: normalizeBool(item?.canBuyItem) && hasIDRPrice,
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
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);

  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${apiBase}/api/market/chatgpt?i18n=en-US`, { method: "GET" });
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
      `${item.title} ${item.displayPriceIDR} ${item.status} ${item.seller}`.toLowerCase().includes(term)
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
        headers: { "Content-Type": "application/json" },
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

  const cachedBadge = response?.cached ? "cached" : "live";
  const staleBadge = response?.stale ? "stale" : "";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Marketplace</div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">ChatGPT Accounts</h1>
          <TinyBadge label={cachedBadge} />
          {staleBadge ? <TinyBadge label={staleBadge} tone="warning" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">Listing compact. Klik detail untuk lihat spek lengkap akun sebelum beli.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{loading ? "Memuat listing..." : `${filtered.length} item`}</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari title, seller, status..."
            className="w-full sm:w-72 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{error}</div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada item yang cocok.</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/35">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Account</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Harga</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Status</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Seller</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-2.5 py-1.5">
                      <div className="max-w-[360px] truncate font-medium">{item.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {item?.raw?.chatgpt_subscription ? <TinyBadge label={String(item.raw.chatgpt_subscription)} /> : null}
                        {item?.raw?.openai_tier ? <TinyBadge label={String(item.raw.openai_tier)} /> : null}
                        {item?.raw?.chatgpt_country ? <TinyBadge label={String(item.raw.chatgpt_country)} /> : null}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="font-medium">{item.displayPriceIDR}</div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <TinyBadge label={String(item.status)} tone={item.canBuy ? "neutral" : "warning"} />
                    </td>
                    <td className="px-2.5 py-1.5">{String(item.seller)}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDrawerItem(item)}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCheckout(item.id, item.canBuy)}
                          disabled={checkingOut === item.id || !item.canBuy}
                          className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {checkingOut === item.id ? "..." : item.canBuy ? "Beli" : "N/A"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SpecDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
    </div>
  );
}

function TinyBadge({ label, tone = "neutral" }) {
  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-border bg-background text-muted-foreground";
  return <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${toneClass}`}>{label}</span>;
}

function SpecDrawer({ item, onClose }) {
  if (!item) return null;

  const specs = [
    ["Subscription", item?.raw?.chatgpt_subscription],
    ["Subscription Ends", formatUnixDate(item?.raw?.chatgpt_subscription_ends)],
    ["Auto Renewal", boolText(item?.raw?.chatgpt_subscription_auto_renew)],
    ["Country", item?.raw?.chatgpt_country],
    ["Register Date", formatUnixDate(item?.raw?.chatgpt_register_date)],
    ["Phone Linked", boolText(item?.raw?.chatgpt_phone)],
    ["Email Type", item?.raw?.email_type],
    ["Email Provider", item?.raw?.email_provider],
    ["Email Domain", item?.raw?.item_domain],
    ["OpenAI Tier", item?.raw?.openai_tier],
    ["OpenAI Balance", item?.raw?.openai_balance],
    ["Can Buy", boolText(item?.raw?.canBuyItem)],
    ["Can Resell", boolText(item?.raw?.canResellItemAfterPurchase)],
    ["Seller Sold", item?.raw?.seller?.sold_items_count],
  ].filter((row) => row?.[1] !== null && row?.[1] !== undefined && String(row?.[1]).trim() !== "");

  return (
    <>
      <button type="button" aria-label="Close detail drawer" onClick={onClose} className="fixed inset-0 z-40 bg-black/25" />
      <aside className="fixed z-50 w-full border-l border-border bg-card shadow-2xl md:top-0 md:right-0 md:h-full md:w-[360px] bottom-0 left-0 max-h-[80vh] md:max-h-none rounded-t-2xl md:rounded-none">
        <div className="flex items-start justify-between border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Account Specs</div>
            <h2 className="truncate text-sm font-semibold">{item.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <TinyBadge label={`Harga ${item.displayPriceIDR || String(item.price)}`} />
              <TinyBadge label={`Seller ${item.seller}`} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
            Tutup
          </button>
        </div>

        <div className="h-[calc(80vh-64px)] md:h-[calc(100vh-64px)] overflow-auto p-3">
          <div className="grid grid-cols-1 gap-2">
            {specs.map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-background px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="mt-0.5 text-xs text-foreground break-all">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function boolText(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return "Yes";
  if (value === false || value === 0 || value === "0" || value === "false") return "No";
  return "";
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
