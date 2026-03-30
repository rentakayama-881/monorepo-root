"use client";
import { PageLoadingBlock } from "@/components/ui/LoadingState";
import { ChevronLeft } from "lucide-react";
import useWithdraw from "./useWithdraw";
import WithdrawForm from "./components/WithdrawForm";
import WithdrawConfirm from "./components/WithdrawConfirm";

export default function WithdrawPage() {
  const {
    step,
    wallet,
    loading,
    processing,
    error,
    cryptoCurrency,
    setCryptoCurrency,
    network,
    setNetwork,
    cryptoAddress,
    setCryptoAddress,
    memo,
    setMemo,
    amount,
    pin,
    setPin,
    parsedAmount,
    fee,
    totalDeduction,
    availableNetworks,
    cryptoCurrencies,
    isStep1Valid,
    isStep2Valid,
    handleAmountChange,
    handleQuickAmount,
    handleWithdraw,
    goBack,
    goNext,
  } = useWithdraw();

  if (loading) {
    return (
      <PageLoadingBlock className="min-h-screen bg-background" maxWidthClass="max-w-md" lines={4} />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={goBack}
            className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step > 1 ? "Kembali" : "Wallet"}
          </button>
          <h1 className="text-xl font-semibold text-foreground">Penarikan</h1>
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Saldo saat ini</span>
            <span className="text-sm font-bold text-foreground">
              Rp{wallet.balance.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1 & 2 */}
        {step < 3 && (
          <WithdrawForm
            step={step}
            cryptoCurrency={cryptoCurrency}
            setCryptoCurrency={setCryptoCurrency}
            network={network}
            setNetwork={setNetwork}
            cryptoAddress={cryptoAddress}
            setCryptoAddress={setCryptoAddress}
            memo={memo}
            setMemo={setMemo}
            amount={amount}
            parsedAmount={parsedAmount}
            fee={fee}
            totalDeduction={totalDeduction}
            wallet={wallet}
            availableNetworks={availableNetworks}
            cryptoCurrencies={cryptoCurrencies}
            isStep1Valid={isStep1Valid}
            isStep2Valid={isStep2Valid}
            handleAmountChange={handleAmountChange}
            handleQuickAmount={handleQuickAmount}
            goNext={goNext}
          />
        )}

        {/* Step 3: Confirmation & PIN */}
        {step === 3 && (
          <WithdrawConfirm
            cryptoCurrency={cryptoCurrency}
            network={network}
            cryptoAddress={cryptoAddress}
            memo={memo}
            parsedAmount={parsedAmount}
            fee={fee}
            totalDeduction={totalDeduction}
            pin={pin}
            setPin={setPin}
            processing={processing}
            handleWithdraw={handleWithdraw}
          />
        )}
      </div>
    </div>
  );
}
