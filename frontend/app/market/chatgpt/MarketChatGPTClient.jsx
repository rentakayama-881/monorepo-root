"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CenteredSpinner } from "@/components/ui/LoadingState";
import Modal from "@/components/ui/Modal";
import { fetchJsonAuth, getApiBase } from "@/lib/api";
import { FEATURE_ENDPOINTS, fetchFeatureAuth, unwrapFeatureData } from "@/lib/featureApi";

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
  const id = item?.chatgpt_item_id ?? item?.item_id ?? item?.account_id ?? item?.id ?? `row-${index}`;
  const isFallbackID = String(id).startsWith("row-");
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
      : "Price unavailable";

  return {
    id: String(id),
    title: item?.title ?? item?.name ?? item?.account_title ?? item?.description ?? `Account ${index + 1}`,
    price: item?.priceWithSellerFee ?? item?.price ?? item?.amount ?? item?.cost ?? "-",
    displayPriceIDR: normalizedIDR,
    displayPriceSource: "",
    priceSourceSymbol: item?.price_source_symbol ?? "",
    priceSourceCurrency: item?.price_source_currency ?? "",
    priceIDR: item?.price_idr ?? 0,
    status: item?.item_state ?? item?.status ?? item?.state ?? item?.availability ?? "Available",
    seller,
    canBuy: normalizeBool(item?.canBuyItem) && hasIDRPrice && !isFallbackID,
    idValid: !isFallbackID,
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

function normalizeCheckoutErrorMessage(message) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("saldo kamu tidak mencukupi") || lower.includes("insufficient") || lower.includes("balance")) {
    return "Your balance is insufficient.";
  }
  if (
    lower.includes("item not found in current listing") ||
    lower.includes("item not found") ||
    lower.includes("ad not found") ||
    lower.includes("sold")
  ) {
    return "This account is currently unavailable.";
  }
  if (
    lower.includes("supplier") ||
    lower.includes("akun belum siap") ||
    lower.includes("checker") ||
    lower.includes("provider")
  ) {
    return "This account is currently unavailable.";
  }
  return raw || "Unable to continue checkout at the moment.";
}

function toCheckoutFeedback(message) {
  const normalized = normalizeCheckoutErrorMessage(message);
  const lower = normalized.toLowerCase();
  const isUnavailable = lower.includes("unavailable") || lower.includes("not available");
  const isInsufficient = lower.includes("insufficient");
  const variant = isUnavailable ? "warning" : "error";
  const title = isUnavailable ? "Account unavailable" : isInsufficient ? "Insufficient balance" : "Checkout failed";

  return {
    title,
    message: normalized,
    variant,
  };
}

export default function MarketChatGPTClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState("");
  const [listingError, setListingError] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState(null);
  const [refreshingListings, setRefreshingListings] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);
  const isMountedRef = useRef(false);

  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadListings = useCallback(
    async ({ initial = false, silent = false } = {}) => {
      if (initial && isMountedRef.current) {
        setLoading(true);
      }
      try {
        const res = await fetch(`${apiBase}/api/market/chatgpt?i18n=en-US`, { method: "GET" });
        const data = await parseApiResponseSafe(res);
        if (!res.ok) throw new Error(data?.error || "Unable to load marketplace listings.");
        if (isMountedRef.current) {
          setResponse(data);
          setListingError("");
        }
        return { ok: true };
      } catch (err) {
        const nextError = err?.message || "Unable to load marketplace listings.";
        if (isMountedRef.current && (initial || !silent)) {
          setListingError(nextError);
        }
        return { ok: false, error: nextError };
      } finally {
        if (initial && isMountedRef.current) setLoading(false);
      }
    },
    [apiBase]
  );

  useEffect(() => {
    void loadListings({ initial: true });
    const timer = setInterval(() => {
      void loadListings({ initial: false, silent: true });
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadListings]);

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
      setCheckoutFeedback(toCheckoutFeedback("This item is not available for purchase right now. Please refresh the listing."));
      return;
    }
    setCheckingOut(itemID);
    setCheckoutFeedback(null);
    try {
      // Hard stop on client side for zero/insufficient balance before checkout request.
      const walletPayload = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
      const wallet = unwrapFeatureData(walletPayload) || {};
      const balance = Number(wallet?.balance ?? wallet?.Balance ?? 0) || 0;
      if (balance <= 0) {
        throw new Error("Your balance is insufficient.");
      }

      const data = await fetchJsonAuth("/api/market/chatgpt/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemID, i18n: "en-US" }),
      });
      const orderID = data?.order?.id;
      if (!orderID) throw new Error("The order was created, but the order ID is missing.");
      router.push(`/market/chatgpt/orders/${encodeURIComponent(orderID)}`);
    } catch (err) {
      setCheckoutFeedback(toCheckoutFeedback(err?.message));
    } finally {
      setCheckingOut("");
    }
  }

  const handleRefreshListings = useCallback(async () => {
    if (isMountedRef.current) {
      setRefreshingListings(true);
    }

    const result = await loadListings({ initial: true });
    if (!isMountedRef.current) {
      return;
    }

    if (result.ok) {
      setCheckoutFeedback(null);
    } else {
      setCheckoutFeedback({
        title: "Unable to refresh listings",
        message: result.error || "Unable to load marketplace listings.",
        variant: "error",
      });
    }
    setRefreshingListings(false);
  }, [loadListings]);

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
        <p className="text-xs text-muted-foreground">Compact listing. Open details to review full account specifications before purchasing.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {loading ? (
            <CenteredSpinner className="justify-start" sizeClass="h-3.5 w-3.5" srLabel="Loading listings" />
          ) : (
            <div className="text-xs text-muted-foreground">{`${filtered.length} items`}</div>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, seller, or status..."
            className="w-full sm:w-72 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
        </div>

        {listingError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{listingError}</div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matching items found.</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/35">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Account</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Price</th>
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
                      {!item.idValid ? <div className="mt-1 text-[10px] text-amber-600">Item ID is not yet valid</div> : null}
                    </td>
                    <td className="px-2.5 py-1.5">{String(item.seller)}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDrawerItem(item)}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCheckout(item.id, item.canBuy)}
                          disabled={checkingOut === item.id || !item.canBuy}
                          className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {checkingOut === item.id ? "..." : item.canBuy ? "Buy" : "N/A"}
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
      <CheckoutFeedbackModal
        feedback={checkoutFeedback}
        onClose={() => setCheckoutFeedback(null)}
        onRefresh={handleRefreshListings}
        refreshing={refreshingListings}
      />
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
    ["OpenAI Tier", item?.raw?.openai_tier],
    ["OpenAI Balance", item?.raw?.openai_balance],
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
              <TinyBadge label={`Price ${item.displayPriceIDR || String(item.price)}`} />
              <TinyBadge label={`Seller ${item.seller}`} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
            Close
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

function CheckoutFeedbackModal({ feedback, onClose, onRefresh, refreshing }) {
  if (!feedback) return null;

  const toneClass =
    feedback.variant === "warning"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-destructive/30 bg-destructive/10 text-destructive";

  const iconPath =
    feedback.variant === "warning"
      ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z";

  return (
    <Modal open={Boolean(feedback)} onClose={onClose} title={feedback.title} size="sm">
      <div className="space-y-4">
        <div className={`rounded-md border px-3 py-2.5 text-sm ${toneClass}`}>
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
            <p className="leading-relaxed">{feedback.message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh listings"}
          </button>
        </div>
      </div>
    </Modal>
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
    return new Date(seconds * 1000).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
