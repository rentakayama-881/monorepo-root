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
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Akun ChatGPT</h1>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              <span
                className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse"
                aria-hidden="true"
              />
              Live
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Temukan akun ChatGPT premium dengan harga terbaik.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari akun..."
            className="w-full rounded-xl bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRefreshListings()}
            disabled={refreshingListings}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RefreshCw className={cn("size-4", refreshingListings && "animate-spin")} />
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
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Hapus pencarian
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleRefreshListings()}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
