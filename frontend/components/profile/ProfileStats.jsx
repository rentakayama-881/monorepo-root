import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function ProfileStats({ wallet, guarantee }) {
  const balanceText = formatCurrency(wallet.balance);
  const guaranteeText = formatCurrency(guarantee.amount);

  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Saldo
          </div>
          <div
            className="truncate text-base font-bold tracking-tight text-foreground"
            title={balanceText}
            aria-label={`Saldo ${balanceText}`}
          >
            {balanceText}
          </div>
          {guarantee.amount > 0 && (
            <div
              className="truncate text-[10px] text-muted-foreground"
              title={`Garansi: ${guaranteeText}`}
            >
              Garansi: <span className="font-medium text-success">{guaranteeText}</span>
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
