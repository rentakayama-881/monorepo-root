import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";

export default function ProfileStats({ wallet, guarantee }) {
  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-gradient-to-b from-secondary/40 to-card p-2.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground">Balance</div>
          <div className="text-base font-semibold tracking-tight text-foreground">
            Rp {wallet.balance.toLocaleString("id-ID")}
          </div>
          {guarantee.amount > 0 && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Active Guarantee:{" "}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Rp {guarantee.amount.toLocaleString("id-ID")}
              </span>
            </div>
          )}
        </div>
        <Link
          href="/account/wallet/deposit"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowDownToLine className="h-3 w-3" strokeWidth={2.5} />
          Deposit
        </Link>
      </div>
    </div>
  );
}
