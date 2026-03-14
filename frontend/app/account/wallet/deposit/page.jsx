"use client";
import { PageLoadingBlock } from "@/components/ui/LoadingState";
import PaymentWaiting from "@/components/wallet/PaymentWaiting";
import { ChevronLeft } from "lucide-react";
import useDeposit from "./useDeposit";
import DepositForm from "./components/DepositForm";
import DepositHistory from "./components/DepositHistory";
import DepositSuccess from "./components/DepositSuccess";
import IncompleteDataFallback from "./components/IncompleteDataFallback";

export default function DepositPage() {
  const {
    router,
    step,
    loading,
    processing,
    error,
    copied,
    cancelling,
    wallet,
    amount,
    payCurrency,
    network,
    availableNetworks,
    depositData,
    countdown,
    countdownTotal,
    depositHistory,
    parsedAmount,
    platformFee,
    totalCharge,
    isDepositComplete,
    onPayCurrencyChange,
    onNetworkChange,
    onAmountChange,
    onQuickAmount,
    onCreateDeposit,
    onCopyAddress,
    onCancelDeposit,
    onResetToStep1,
  } = useDeposit();

  if (loading) {
    return (
      <PageLoadingBlock className="min-h-screen bg-background" maxWidthClass="max-w-md" lines={4} />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          {step !== 2 && (
            <button
              onClick={() => router.push("/account/wallet/transactions")}
              className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Wallet
            </button>
          )}
          <h1 className="text-xl font-bold text-foreground">Deposit</h1>
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

        {/* STEP 1: Amount & Crypto Selection */}
        {step === 1 && (
          <DepositForm
            payCurrency={payCurrency}
            onPayCurrencyChange={onPayCurrencyChange}
            network={network}
            onNetworkChange={onNetworkChange}
            availableNetworks={availableNetworks}
            amount={amount}
            onAmountChange={onAmountChange}
            onQuickAmount={onQuickAmount}
            parsedAmount={parsedAmount}
            platformFee={platformFee}
            totalCharge={totalCharge}
            processing={processing}
            onSubmit={onCreateDeposit}
          />
        )}

        {/* STEP 2: Payment Details */}
        {step === 2 && isDepositComplete && (
          <PaymentWaiting
            depositData={depositData}
            countdown={countdown}
            countdownTotal={countdownTotal}
            copied={copied}
            onCopyAddress={onCopyAddress}
            cancelling={cancelling}
            onCancelDeposit={onCancelDeposit}
          />
        )}

        {/* STEP 2: Incomplete data guard — fallback to step 1 */}
        {step === 2 && !isDepositComplete && <IncompleteDataFallback onReset={onResetToStep1} />}

        {/* STEP 3: Success */}
        {step === 3 && (
          <DepositSuccess
            depositAmount={depositData?.amount}
            walletBalance={wallet.balance}
            onDepositAgain={onResetToStep1}
            onGoToWallet={() => router.push("/account/wallet/transactions")}
          />
        )}

        {/* Deposit History */}
        {step !== 2 && <DepositHistory history={depositHistory} />}
      </div>
    </div>
  );
}
