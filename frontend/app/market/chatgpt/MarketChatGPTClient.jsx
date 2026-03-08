"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CenteredSpinner } from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import Portal from "@/components/ui/Portal";
import { fetchJsonAuth } from "@/lib/api";
import {
  boolText,
  formatUnixDate,
  getCheckoutConfirmSeconds,
  toCheckoutFeedback,
} from "./marketChatGPTUtils";
import useMarketChatGPTListing from "./useMarketChatGPTListing";

function usePageScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof window === "undefined" || typeof document === "undefined")
      return undefined;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      const canRestoreScroll =
        typeof window.scrollTo === "function" && !/jsdom/i.test(window.navigator?.userAgent || "");
      if (canRestoreScroll) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [locked]);
}

export default function MarketChatGPTClient() {
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);
  const [confirmCountdown, setConfirmCountdown] = useState(getCheckoutConfirmSeconds());
  const [blockingMessage, setBlockingMessage] = useState("");
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");
  const {
    loading,
    listingError,
    refreshingListings,
    query,
    setQuery,
    response,
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    placeholderCount,
    displayStart,
    displayEnd,
    setPage,
    refreshListings,
    lastFetchedAt,
  } = useMarketChatGPTListing();

  const confirmSeconds = getCheckoutConfirmSeconds();

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
  }, [confirmItem, confirmSeconds]);

  usePageScrollLock(Boolean(confirmItem || blockingMessage || checkoutFeedback));

  useEffect(() => {
    if (!lastFetchedAt) return;
    function update() {
      const seconds = Math.floor((Date.now() - lastFetchedAt) / 1000);
      if (seconds < 5) setLastUpdatedLabel("Baru saja diperbarui");
      else if (seconds < 60) setLastUpdatedLabel(`Diperbarui ${seconds} detik lalu`);
      else setLastUpdatedLabel(`Diperbarui ${Math.floor(seconds / 60)} menit lalu`);
    }
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [lastFetchedAt]);

  async function runCheckout(item) {
    if (!item?.canBuy) {
      setCheckoutFeedback(
        toCheckoutFeedback(
          "Akun saat ini belum tersedia untuk dibeli. Silakan muat ulang daftar akun."
        )
      );
      return;
    }

    setCheckingOut(item.id);
    setCheckoutFeedback(null);
    setBlockingMessage("Sedang memverifikasi saldo dan menyiapkan pesanan. Mohon tunggu.");

    try {
      setBlockingMessage(
        "Pesanan sedang dibuat. Mohon jangan menutup atau me-refresh halaman ini."
      );
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

  async function handleRefreshListings() {
    const result = await refreshListings();
    if (result.ok) {
      setCheckoutFeedback(null);
    } else {
      setCheckoutFeedback({
        message: result.error || "Gagal memuat daftar akun.",
        variant: "error",
      });
    }
  }

  const cachedBadge = response?.cached ? "cache" : "Live";
  const staleBadge = response?.stale ? "sementara" : "";

  return (
    <div className="space-y-4 [scrollbar-gutter:stable]">
      <header className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Marketplace
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Akun ChatGPT</h1>
          {cachedBadge === "Live" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                aria-hidden="true"
              />
              Live
            </span>
          ) : (
            <TinyBadge label={cachedBadge} />
          )}
          {staleBadge ? <TinyBadge label={staleBadge} tone="warning" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Catatan penting: apabila Anda melihat harga yang tampak tidak wajar, kemungkinan besar itu
          adalah harga sementara (placeholder) sebelum penjual menyelesaikan kesiapan akun untuk
          transaksi final.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {loading ? (
            <CenteredSpinner
              className="justify-start"
              sizeClass="h-3.5 w-3.5"
              srLabel="Memuat daftar akun"
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {totalItems > 0
                  ? `Menampilkan ${displayStart}-${displayEnd} dari ${totalItems} akun`
                  : "Belum ada akun untuk ditampilkan"}
              </span>
              {lastUpdatedLabel && !refreshingListings ? (
                <span className="hidden sm:inline text-[10px] opacity-60">
                  • {lastUpdatedLabel}
                </span>
              ) : null}
            </div>
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul, penjual, status, atau waktu upload..."
              className="w-full sm:w-80 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                void handleRefreshListings();
              }}
              disabled={refreshingListings}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-60"
            >
              {refreshingListings ? "Memuat ulang..." : "Muat ulang daftar"}
            </button>
          </div>
        </div>

        {listingError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {listingError}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : totalItems === 0 ? (
          <EmptyState
            compact
            title="Belum ada akun tersedia"
            description={
              query
                ? "Coba ubah kata kunci pencarian Anda."
                : "Belum ada akun yang dijual saat ini. Cek kembali nanti."
            }
            action={
              query
                ? { label: "Hapus pencarian", onClick: () => setQuery("") }
                : { label: "Muat ulang", onClick: () => void handleRefreshListings() }
            }
          />
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
              {Array.from({ length: placeholderCount }).map((_, index) => (
                <MobileAccountCardPlaceholder key={`mobile-placeholder-${currentPage}-${index}`} />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card md:block">
              <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] gap-3 border-b border-border/40 bg-muted/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                {Array.from({ length: placeholderCount }).map((_, index) => (
                  <DesktopAccountRowPlaceholder
                    key={`desktop-placeholder-${currentPage}-${index}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/10 px-3 py-2">
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
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${toneClass}`}>
      {label}
    </span>
  );
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
    <article className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] items-center gap-3 px-3 py-2.5 text-xs transition-colors hover:bg-muted/30">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{item.title}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {item?.raw?.chatgpt_subscription ? (
            <TinyBadge label={String(item.raw.chatgpt_subscription)} />
          ) : null}
          {item?.raw?.openai_tier ? <TinyBadge label={String(item.raw.openai_tier)} /> : null}
          {item?.raw?.chatgpt_country ? (
            <TinyBadge label={String(item.raw.chatgpt_country)} />
          ) : null}
        </div>
      </div>

      <div className="font-semibold text-foreground">{item.displayPriceIDR}</div>

      <div className="space-y-1">
        <TinyBadge label={String(item.status)} tone={item.canBuy ? "neutral" : "warning"} />
        {!item.idValid ? <div className="text-[10px] text-amber-600">ID belum valid</div> : null}
      </div>

      <div className="truncate text-foreground">{String(item.seller)}</div>
      <div className="text-muted-foreground">{item.uploadedAtLabel}</div>

      <AccountActionButtons
        item={item}
        checkingOut={checkingOut}
        onDetail={onDetail}
        onBuy={onBuy}
        align="right"
      />
    </article>
  );
}

function DesktopAccountRowPlaceholder() {
  return (
    <article
      aria-hidden="true"
      data-testid="market-desktop-pagination-placeholder"
      className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] items-center gap-3 px-3 py-2.5 text-xs opacity-0 pointer-events-none"
    >
      <div>&nbsp;</div>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
    </article>
  );
}

function MobileAccountCard({ item, checkingOut, onDetail, onBuy }) {
  return (
    <article className="rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-snug break-words text-foreground">
          {item.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item?.raw?.chatgpt_subscription ? (
            <TinyBadge label={String(item.raw.chatgpt_subscription)} />
          ) : null}
          {item?.raw?.openai_tier ? <TinyBadge label={String(item.raw.openai_tier)} /> : null}
          {item?.raw?.chatgpt_country ? (
            <TinyBadge label={String(item.raw.chatgpt_country)} />
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AccountMetaField label="Harga" value={item.displayPriceIDR} strong />
        <AccountMetaField
          label="Status"
          value={
            <TinyBadge label={String(item.status)} tone={item.canBuy ? "neutral" : "warning"} />
          }
        />
        <AccountMetaField label="Penjual" value={String(item.seller)} />
        <AccountMetaField label="Diunggah" value={item.uploadedAtLabel} />
      </div>

      {!item.idValid ? (
        <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700">
          ID akun belum valid. Silakan muat ulang daftar.
        </div>
      ) : null}

      <div className="mt-3">
        <AccountActionButtons
          item={item}
          checkingOut={checkingOut}
          onDetail={onDetail}
          onBuy={onBuy}
        />
      </div>
    </article>
  );
}

function MobileAccountCardPlaceholder() {
  return (
    <article
      aria-hidden="true"
      data-testid="market-mobile-pagination-placeholder"
      className="pointer-events-none rounded-xl border border-border/60 bg-card p-3 opacity-0"
    >
      <div className="h-28" />
    </article>
  );
}

function AccountMetaField({ label, value, strong = false }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-xs break-words ${strong ? "font-semibold text-foreground" : "text-foreground"}`}
      >
        {value}
      </div>
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
    <Portal>
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detail akun"
        className="fixed z-[110] w-full border-l border-border bg-card shadow-2xl animate-slide-up md:top-0 md:right-0 md:h-full md:w-[380px] md:animate-slide-in-from-right bottom-0 left-0 max-h-[82vh] md:max-h-none rounded-t-2xl md:rounded-none"
      >
        <div className="flex items-start justify-between border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Detail Akun
            </div>
            <h2 className="truncate text-sm font-semibold">{item.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <TinyBadge label={`Harga ${item.displayPriceIDR}`} />
              <TinyBadge label={`Penjual ${item.seller}`} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/40"
          >
            Tutup
          </button>
        </div>

        <div className="h-[calc(82vh-64px)] md:h-[calc(100vh-64px)] overflow-auto p-3">
          <div className="grid grid-cols-1 gap-2">
            {specs.map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-border bg-background px-2.5 py-2"
              >
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="mt-0.5 text-xs text-foreground break-all">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </Portal>
  );
}

function CheckoutConfirmModal({ item, countdown, onCancel, onConfirm, disabled }) {
  if (!item) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/55" />
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Konfirmasi Pembelian
          </div>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Pastikan pesanan sudah benar
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Anda akan membeli akun <span className="font-medium text-foreground">{item.title}</span>{" "}
            dengan harga
            <span className="font-medium text-foreground"> {item.displayPriceIDR}</span>.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Untuk mencegah pembelian tidak sengaja, tombol konfirmasi akan aktif setelah hitung
            mundur selesai.
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
          <p className="mt-2 text-xs text-amber-700">
            Mohon jangan menutup atau me-refresh halaman hingga proses selesai.
          </p>
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
