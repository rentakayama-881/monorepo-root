"use client";

import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/swr";
import { Wallet, Clock, Info } from "lucide-react";

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "Rp 0";
  return `Rp ${Math.floor(amount).toLocaleString("id-ID")}`;
}

export default function PricingBanner({ pricing }) {
  const { wallet, isLoading: walletLoading } = useWallet();

  const balance = wallet?.data?.balance ?? wallet?.balance ?? 0;
  const pricePerHour = pricing?.price_per_hour ?? 10000;

  return (
    <div className={cn("rounded-[var(--radius)] bg-card p-4", "border border-border/50")}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {/* Saldo */}
        <div className="flex items-center gap-1.5">
          <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Saldo:</span>
          {walletLoading ? (
            <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <span className="font-semibold text-foreground">{formatCurrency(balance)}</span>
          )}
        </div>

        {/* Harga per jam */}
        <div className="flex items-center gap-1.5">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Harga:</span>
          <span className="font-semibold text-foreground">{formatCurrency(pricePerHour)}/jam</span>
        </div>

        {/* Info billing */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Billing per menit. Sesi berhenti otomatis jika saldo habis.</span>
        </div>
      </div>
    </div>
  );
}
