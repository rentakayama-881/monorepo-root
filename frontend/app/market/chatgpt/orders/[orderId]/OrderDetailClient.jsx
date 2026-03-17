"use client";

import Link from "next/link";
import { SectionLoadingBlock } from "@/components/ui/LoadingState";
import useOrderDetail from "./useOrderDetail";
import OrderStatus from "./components/OrderStatus";
import OrderCredentials from "./components/OrderCredentials";
import OrderTimeline from "./components/OrderTimeline";

export default function MarketChatGPTOrderDetailClient() {
  const {
    loading,
    error,
    order,
    manualRefresh,
    progressModalOpen,
    setProgressModalOpen,
    statusText,
    currentStep,
    statusNormalized,
    isProcessing,
    handleRefresh,
  } = useOrderDetail();

  return (
    <main className="container py-10 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Marketplace
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Detail Pembelian</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan status dan data akun yang berhasil dibeli.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        {loading ? (
          <SectionLoadingBlock lines={4} compact srLabel="Memuat detail pembelian" />
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && !order ? (
          <p className="text-sm text-muted-foreground">Data pembelian tidak ditemukan.</p>
        ) : null}

        {!loading && !error && order ? (
          <div className="space-y-4">
            <OrderStatus
              order={order}
              statusText={statusText}
              statusNormalized={statusNormalized}
              currentStep={currentStep}
              isProcessing={isProcessing}
              onShowProgress={() => setProgressModalOpen(true)}
            />
            <OrderCredentials order={order} statusNormalized={statusNormalized} />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/market/chatgpt"
          className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
        >
          Kembali ke daftar akun
        </Link>
        <Link
          href="/account/my-purchases"
          className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
        >
          Buka Riwayat Pembelian
        </Link>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || manualRefresh || isProcessing}
          className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {manualRefresh ? "Memuat ulang..." : "Muat Ulang Status"}
        </button>
      </div>

      <OrderTimeline
        open={progressModalOpen}
        lock={isProcessing}
        order={order}
        onClose={() => setProgressModalOpen(false)}
      />
    </main>
  );
}
