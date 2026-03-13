"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Portal from "@/components/ui/Portal";
import { fetchJsonAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getCheckoutConfirmSeconds, toCheckoutFeedback } from "./marketChatGPTUtils";
import useMarketChatGPTListing from "./useMarketChatGPTListing";
import { MarketAccountCard, MarketAccountCardSkeleton, SpecDrawer } from "./MarketAccountCard";
import { CheckoutConfirmModal, CheckoutBlockingModal, CheckoutFeedbackModal } from "./MarketModals";

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
    items,
    totalItems,
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

  const isLive = !response?.cached;

  return (
    <div className="space-y-6 [scrollbar-gutter:stable]">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Akun ChatGPT</h1>
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              <span
                className="inline-block size-1.5 rounded-full bg-success animate-pulse"
                aria-hidden="true"
              />
              Live
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Catatan penting: apabila Anda melihat harga yang tampak tidak wajar, kemungkinan besar itu
          adalah harga sementara (placeholder) sebelum penjual menyelesaikan kesiapan akun untuk
          transaksi final.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari akun..."
            aria-label="Cari akun"
            className="w-full rounded-[var(--radius)] bg-muted/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshListings()}
            disabled={refreshingListings}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RefreshCw className={cn("size-3.5", refreshingListings && "animate-spin")} />
            <span className="hidden sm:inline">
              {refreshingListings ? "Memuat ulang..." : "Muat ulang"}
            </span>
          </button>
        </div>
      </div>

      {!loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {totalItems > 0 ? `${totalItems} akun tersedia` : "Belum ada akun untuk ditampilkan"}
          </span>
          {lastUpdatedLabel && !refreshingListings ? (
            <span className="opacity-60">· {lastUpdatedLabel}</span>
          ) : null}
        </div>
      ) : null}

      {listingError ? (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {listingError}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketAccountCardSkeleton key={i} />
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
            query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Hapus pencarian
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleRefreshListings()}
                className="rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Muat ulang
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MarketAccountCard
              key={item.id}
              item={item}
              checkingOut={checkingOut}
              onDetail={() => setDrawerItem(item)}
              onBuy={() => setConfirmItem(item)}
            />
          ))}
        </div>
      )}

      <Portal>
        <SpecDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
      </Portal>

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
