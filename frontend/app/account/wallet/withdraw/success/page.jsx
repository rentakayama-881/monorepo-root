"use client";
import Link from "next/link";

export default function WithdrawSuccessPage() {
  return (
    <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <svg
              className="h-10 w-10 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Penarikan Diproses
          </h1>
          <p className="text-muted-foreground mb-8">
            Permintaan penarikan Anda sedang diproses. Dana akan ditransfer ke rekening Anda dalam 1-3 hari kerja.
          </p>

          <div className="rounded-lg border border-border bg-card p-4 mb-8">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Anda akan menerima notifikasi email ketika dana telah ditransfer.</span>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/account/wallet/transactions"
              className="block w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Lihat Transaksi
            </Link>
            <Link
              href="/"
              className="block w-full rounded-lg border border-border py-3 font-medium text-foreground transition hover:bg-card"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
  );
}
