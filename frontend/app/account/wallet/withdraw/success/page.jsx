"use client";
import Link from "next/link";
import { CheckCircle, Info } from "lucide-react";

export default function WithdrawSuccessPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 sm:px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle className="h-10 w-10 text-success" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">Penarikan Diproses</h1>
        <p className="text-muted-foreground mb-8">
          Permintaan penarikan Anda sedang diproses. Dana akan dikirim ke alamat crypto tujuan
          setelah dikonfirmasi.
        </p>

        <div className="rounded-lg border border-border bg-card p-4 mb-8">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Info className="h-5 w-5 text-primary" />
            <span>Anda dapat memantau status penarikan di halaman riwayat transaksi.</span>
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
