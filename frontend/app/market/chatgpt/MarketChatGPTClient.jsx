"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CenteredSpinner } from "@/components/ui/LoadingState";
import { fetchJsonAuth, getApiBase } from "@/lib/api";
import { FEATURE_ENDPOINTS, fetchFeatureAuth, unwrapFeatureData } from "@/lib/featureApi";
import { extractList } from "@/lib/apiHelpers";

const MARKET_PAGE_SIZE = 10;
const JAKARTA_TIMEZONE = "Asia/Jakarta";

function getCheckoutConfirmSeconds() {
  const raw = Number(process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS);
  if (!Number.isFinite(raw) || raw < 0) return 60;
  return Math.floor(raw);
}

function normalizeBool(value) {
  if (value === null || value === undefined || value === "") return true;
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return true;
}

function parseUnixSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function formatUnixDateTime(value) {
  const seconds = parseUnixSeconds(value);
  if (!seconds) return "-";
  try {
    const formatted = new Date(seconds * 1000).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: JAKARTA_TIMEZONE,
    });
    return `${formatted} WIB`;
  } catch {
    return "-";
  }
}

function usePageScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof window === "undefined" || typeof document === "undefined") return undefined;

    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
    };
  }, [locked]);
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
      : "Harga belum tersedia";

  const uploadedAtSeconds =
    parseUnixSeconds(item?.published_date) ||
    parseUnixSeconds(item?.refreshed_date) ||
    parseUnixSeconds(item?.update_stat_date) ||
    parseUnixSeconds(item?.edit_date);

  return {
    id: String(id),
    title:
      item?.title_en ?? item?.title ?? item?.name_en ?? item?.name ?? item?.account_title ?? item?.description_en ?? item?.description ?? `Akun ${index + 1}`,
    displayPriceIDR: normalizedIDR,
    priceSourceSymbol: item?.price_source_symbol ?? "",
    priceSourceCurrency: item?.price_source_currency ?? "",
    priceIDR: item?.price_idr ?? 0,
    status: item?.item_state ?? item?.status ?? item?.state ?? item?.availability ?? "Tersedia",
    seller,
    canBuy: normalizeBool(item?.canBuyItem) && hasIDRPrice && !isFallbackID,
    idValid: !isFallbackID,
    uploadedAtSeconds,
    uploadedAtLabel: uploadedAtSeconds ? formatUnixDateTime(uploadedAtSeconds) : "-",
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
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("context canceled")) {
    return "Permintaan melebihi batas waktu. Silakan coba lagi.";
  }
  if (lower.includes("saldo kamu tidak mencukupi") || lower.includes("saldo wallet anda tidak mencukupi") || lower.includes("insufficient") || lower.includes("balance")) {
    return "Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.";
  }
  if (
    lower.includes("item not found in current listing") ||
    lower.includes("item not found") ||
    lower.includes("ad not found") ||
    lower.includes("sold") ||
    lower.includes("currently unavailable") ||
    lower.includes("akun belum siap") ||
    lower.includes("account validation")
  ) {
    return "Akun saat ini belum tersedia untuk dibeli.";
  }
  return raw || "Pembelian belum dapat diproses saat ini.";
}

function toCheckoutFeedback(message) {
  const normalized = normalizeCheckoutErrorMessage(message);
  const lower = normalized.toLowerCase();
  const isUnavailable = lower.includes("belum tersedia") || lower.includes("tidak tersedia");
  const variant = isUnavailable ? "warning" : "error";

  return {
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
  const [confirmItem, setConfirmItem] = useState(null);
  const [confirmCountdown, setConfirmCountdown] = useState(60);
  const [blockingMessage, setBlockingMessage] = useState("");
  const [page, setPage] = useState(1);
  const isMountedRef = useRef(false);

  const apiBase = useMemo(() => getApiBase(), []);
  const confirmSeconds = useMemo(() => getCheckoutConfirmSeconds(), []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmItem) return;
    setConfirmCountdown(confirmSeconds);
    const timer = setInterval(() => {
      setConfirmCountdown((current) => {
        if (current <= 0) return 0;
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [confirmItem?.id, confirmSeconds]);

  usePageScrollLock(Boolean(drawerItem || confirmItem || blockingMessage || checkoutFeedback));

  const loadListings = useCallback(
    async ({ initial = false, silent = false } = {}) => {
      if (initial && isMountedRef.current) {
        setLoading(true);
      }
      try {
        const res = await fetch(`${apiBase}/api/market/chatgpt?i18n=en-US&ts=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await parseApiResponseSafe(res);
        if (!res.ok) throw new Error(data?.error || "Gagal memuat daftar akun.");
        if (isMountedRef.current) {
          setResponse(data);
          setListingError("");
        }
        return { ok: true };
      } catch (err) {
        const nextError = err?.message || "Gagal memuat daftar akun.";
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
      `${item.title} ${item.displayPriceIDR} ${item.status} ${item.seller} ${item.uploadedAtLabel}`.toLowerCase().includes(term)
    );
  }, [accounts, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setPage((current) => {
      const totalPages = Math.max(1, Math.ceil(filtered.length / MARKET_PAGE_SIZE));
      return Math.min(current, totalPages);
    });
  }, [filtered.length]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / MARKET_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStartIndex = totalItems === 0 ? 0 : (currentPage - 1) * MARKET_PAGE_SIZE;

  const paginatedItems = useMemo(() => {
    return filtered.slice(pageStartIndex, pageStartIndex + MARKET_PAGE_SIZE);
  }, [filtered, pageStartIndex]);

  const displayStart = totalItems === 0 ? 0 : pageStartIndex + 1;
  const displayEnd = Math.min(totalItems, pageStartIndex + paginatedItems.length);

  async function runCheckout(item) {
    if (!item?.canBuy) {
      setCheckoutFeedback(toCheckoutFeedback("Akun saat ini belum tersedia untuk dibeli. Silakan muat ulang daftar akun."));
      return;
    }

    setCheckingOut(item.id);
    setCheckoutFeedback(null);
    setBlockingMessage("Sedang memverifikasi saldo dan menyiapkan pesanan. Mohon tunggu.");

    try {
      const walletPayload = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
      const wallet = unwrapFeatureData(walletPayload) || {};
      const balance = Number(wallet?.balance ?? wallet?.Balance ?? 0) || 0;
      if (balance <= 0) {
        throw new Error("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.");
      }

      setBlockingMessage("Pesanan sedang dibuat. Mohon jangan menutup atau me-refresh halaman ini.");
      const data = await fetchJsonAuth("/api/market/chatgpt/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: 45000,
        body: JSON.stringify({ item_id: item.id, i18n: "en-US" }),
      });

      const orderID = data?.order?.id;
      if (!orderID) throw new Error("Pesanan berhasil dibuat, tetapi ID pesanan tidak ditemukan.");
      router.push(`/market/chatgpt/orders/${encodeURIComponent(orderID)}`);
    } catch (err) {
      setCheckoutFeedback(toCheckoutFeedback(err?.message));
    } finally {
      setCheckingOut("");
      setBlockingMessage("");
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
        message: result.error || "Gagal memuat daftar akun.",
        variant: "error",
      });
    }
    setRefreshingListings(false);
  }, [loadListings]);

  const cachedBadge = response?.cached ? "cache" : "live";
  const staleBadge = response?.stale ? "stale" : "";

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Marketplace</div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Daftar Akun ChatGPT</h1>
          <TinyBadge label={cachedBadge} />
          {staleBadge ? <TinyBadge label={staleBadge} tone="warning" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Catatan penting: apabila Anda melihat harga yang tampak tidak wajar, kemungkinan besar itu adalah harga sementara (placeholder)
          sebelum penjual menyelesaikan kesiapan akun untuk transaksi final.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {loading ? (
            <CenteredSpinner className="justify-start" sizeClass="h-3.5 w-3.5" srLabel="Memuat daftar akun" />
          ) : (
            <div className="text-xs text-muted-foreground">
              {totalItems > 0
                ? `Menampilkan ${displayStart}-${displayEnd} dari ${totalItems} akun`
                : "Belum ada akun untuk ditampilkan"}
            </div>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, penjual, status, atau waktu upload..."
            className="w-full sm:w-80 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
        </div>

        {listingError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{listingError}</div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada akun yang cocok dengan pencarian Anda.</p>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {paginatedItems.map((item) => (
                <MobileAccountCard
                  key={item.id}
                  item={item}
                  checkingOut={checkingOut}
                  onDetail={() => setDrawerItem(item)}
                  onBuy={() => setConfirmItem(item)}
                />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-border bg-background md:block">
              <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] gap-3 border-b border-border bg-muted/30 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                <div>Akun</div>
                <div>Harga</div>
                <div>Status</div>
                <div>Penjual</div>
                <div>Diunggah</div>
                <div className="text-right">Aksi</div>
              </div>
              <div className="divide-y divide-border">
                {paginatedItems.map((item) => (
                  <DesktopAccountRow
                    key={item.id}
                    item={item}
                    checkingOut={checkingOut}
                    onDetail={() => setDrawerItem(item)}
                    onBuy={() => setConfirmItem(item)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  Halaman sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  Halaman berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <SpecDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />

      <CheckoutConfirmModal
        item={confirmItem}
        countdown={confirmCountdown}
        onCancel={() => {
          if (checkingOut) return;
          setConfirmItem(null);
        }}
        onConfirm={() => {
          if (!confirmItem) return;
          const itemToBuy = confirmItem;
          setConfirmItem(null);
          void runCheckout(itemToBuy);
        }}
        disabled={Boolean(checkingOut) || confirmCountdown > 0}
      />

      <CheckoutBlockingModal message={blockingMessage} />

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

function AccountActionButtons({ item, checkingOut, onDetail, onBuy, align = "left" }) {
  return (
    <div className={`flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
      <button
        type="button"
        onClick={onDetail}
        className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted/40"
      >
        Detail
      </button>
      <button
        type="button"
        onClick={onBuy}
        disabled={Boolean(checkingOut) || !item.canBuy}
        className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {checkingOut === item.id ? "Memproses..." : item.canBuy ? "Beli" : "Belum siap"}
      </button>
    </div>
  );
}

function DesktopAccountRow({ item, checkingOut, onDetail, onBuy }) {
  return (
    <article className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] items-center gap-3 px-3 py-2.5 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{item.title}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {item?.raw?.chatgpt_subscription ? <TinyBadge label={String(item.raw.chatgpt_subscription)} /> : null}
          {item?.raw?.openai_tier ? <TinyBadge label={String(item.raw.openai_tier)} /> : null}
          {item?.raw?.chatgpt_country ? <TinyBadge label={String(item.raw.chatgpt_country)} /> : null}
        </div>
      </div>

      <div className="font-semibold text-foreground">{item.displayPriceIDR}</div>

      <div className="space-y-1">
        <TinyBadge label={String(item.status)} tone={item.canBuy ? "neutral" : "warning"} />
        {!item.idValid ? <div className="text-[10px] text-amber-600">ID belum valid</div> : null}
      </div>

      <div className="truncate text-foreground">{String(item.seller)}</div>
      <div className="text-muted-foreground">{item.uploadedAtLabel}</div>

      <AccountActionButtons item={item} checkingOut={checkingOut} onDetail={onDetail} onBuy={onBuy} align="right" />
    </article>
  );
}

function MobileAccountCard({ item, checkingOut, onDetail, onBuy }) {
  return (
    <article className="rounded-lg border border-border bg-background p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-snug break-words text-foreground">{item.title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item?.raw?.chatgpt_subscription ? <TinyBadge label={String(item.raw.chatgpt_subscription)} /> : null}
          {item?.raw?.openai_tier ? <TinyBadge label={String(item.raw.openai_tier)} /> : null}
          {item?.raw?.chatgpt_country ? <TinyBadge label={String(item.raw.chatgpt_country)} /> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AccountMetaField label="Harga" value={item.displayPriceIDR} strong />
        <AccountMetaField label="Status" value={<TinyBadge label={String(item.status)} tone={item.canBuy ? "neutral" : "warning"} />} />
        <AccountMetaField label="Penjual" value={String(item.seller)} />
        <AccountMetaField label="Diunggah" value={item.uploadedAtLabel} />
      </div>

      {!item.idValid ? (
        <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700">
          ID akun belum valid. Silakan muat ulang daftar.
        </div>
      ) : null}

      <div className="mt-3">
        <AccountActionButtons item={item} checkingOut={checkingOut} onDetail={onDetail} onBuy={onBuy} />
      </div>
    </article>
  );
}

function AccountMetaField({ label, value, strong = false }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xs break-words ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function SpecDrawer({ item, onClose }) {
  if (!item) return null;

  const specs = [
    ["Langganan", item?.raw?.chatgpt_subscription],
    ["Akhir Langganan", formatUnixDate(item?.raw?.chatgpt_subscription_ends)],
    ["Perpanjangan Otomatis", boolText(item?.raw?.chatgpt_subscription_auto_renew)],
    ["Negara", item?.raw?.chatgpt_country],
    ["Tanggal Registrasi", formatUnixDate(item?.raw?.chatgpt_register_date)],
    ["Nomor Telepon Tersambung", boolText(item?.raw?.chatgpt_phone)],
    ["Jenis Email", item?.raw?.email_type],
    ["Tier OpenAI", item?.raw?.openai_tier],
    ["Saldo OpenAI", item?.raw?.openai_balance],
    ["Total Akun Terjual Penjual", item?.raw?.seller?.sold_items_count],
    ["Waktu Upload", item?.uploadedAtLabel],
  ].filter((row) => row?.[1] !== null && row?.[1] !== undefined && String(row?.[1]).trim() !== "");

  return (
    <>
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
      />
      <aside className="fixed z-50 w-full border-l border-border bg-card shadow-2xl md:top-0 md:right-0 md:h-full md:w-[380px] bottom-0 left-0 max-h-[82vh] md:max-h-none rounded-t-2xl md:rounded-none">
        <div className="flex items-start justify-between border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Detail Akun</div>
            <h2 className="truncate text-sm font-semibold">{item.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <TinyBadge label={`Harga ${item.displayPriceIDR}`} />
              <TinyBadge label={`Penjual ${item.seller}`} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40">
            Tutup
          </button>
        </div>

        <div className="h-[calc(82vh-64px)] md:h-[calc(100vh-64px)] overflow-auto p-3">
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

function CheckoutConfirmModal({ item, countdown, onCancel, onConfirm, disabled }) {
  if (!item) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/55" />
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Konfirmasi Pembelian</div>
          <h2 className="mt-1 text-base font-semibold text-foreground">Pastikan pesanan sudah benar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Anda akan membeli akun <span className="font-medium text-foreground">{item.title}</span> dengan harga
            <span className="font-medium text-foreground"> {item.displayPriceIDR}</span>.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Untuk mencegah pembelian tidak sengaja, tombol konfirmasi akan aktif setelah hitung mundur selesai.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Penjual: {item.seller}</p>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {countdown > 0 ? `Ya, beli (${countdown} dtk)` : "Ya, beli sekarang"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function CheckoutBlockingModal({ message }) {
  if (!message) return null;
  return (
    <>
      <div className="fixed inset-0 z-[160] bg-black/60" />
      <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            Proses pembelian sedang berjalan
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <p className="mt-2 text-xs text-amber-700">Mohon jangan menutup atau me-refresh halaman hingga proses selesai.</p>
        </div>
      </div>
    </>
  );
}

function CheckoutFeedbackModal({ feedback, onClose, onRefresh, refreshing }) {
  if (!feedback) return null;

  const toneClass =
    feedback.variant === "warning"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <>
      <div data-testid="checkout-feedback-overlay" className="fixed inset-0 z-[180] bg-black/50" />
      <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-3.5 shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
          <div className={`rounded-md border px-3 py-2.5 text-sm ${toneClass}`}>
            <p className="leading-relaxed">{feedback.message}</p>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {refreshing ? "Memuat ulang..." : "Muat ulang daftar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function boolText(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return "Ya";
  if (value === false || value === 0 || value === "0" || value === "false") return "Tidak";
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
      timeZone: JAKARTA_TIMEZONE,
    });
  } catch {
    return "";
  }
}
