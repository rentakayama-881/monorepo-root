import { Check } from "lucide-react";

export default function DepositSuccess({
  depositAmount,
  walletBalance,
  onDepositAgain,
  onGoToWallet,
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg">
        <Check className="h-8 w-8 text-status-success-text" strokeWidth={2} />
      </div>
      <h2 className="text-lg font-bold text-foreground">Deposit Berhasil!</h2>
      <p className="text-sm text-muted-foreground">
        Saldo Anda telah ditambahkan sebesar Rp
        {depositAmount?.toLocaleString("id-ID") ?? "0"}
      </p>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Saldo saat ini</span>
          <span className="font-semibold">Rp{walletBalance.toLocaleString("id-ID")}</span>
        </div>
      </div>
      <button
        onClick={onDepositAgain}
        className="h-10 w-full rounded-lg border border-input text-sm hover:bg-accent transition-colors"
      >
        Deposit Lagi
      </button>
      <button
        onClick={onGoToWallet}
        className="h-10 w-full rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
      >
        Kembali ke Wallet
      </button>
    </div>
  );
}
