import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function ProfileStats({ wallet, guarantee }) {
  const balanceText = formatCurrency(wallet.balance);
  const guaranteeText = formatCurrency(guarantee.amount);

  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-gradient-to-b from-secondary/40 to-card p-2.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-2">
          <div className="text-xs font-medium text-muted-foreground">Saldo</div>
          <div
            className="truncate text-base font-semibold tracking-tight text-foreground"
            title={balanceText}
            aria-label={`Saldo ${balanceText}`}
          >
            {balanceText}
          </div>
          {guarantee.amount > 0 && (
            <div
              className="mt-1 truncate text-xs text-muted-foreground"
              title={`Garansi Aktif: ${guaranteeText}`}
            >
              Garansi Aktif: <span className="font-medium text-success">{guaranteeText}</span>
            </div>
          )}
        </div>
        <Link
          href="/account/wallet/deposit"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowDownToLine className="h-3 w-3" strokeWidth={2.5} />
          Deposit
        </Link>
      </div>
    </div>
  );
}
