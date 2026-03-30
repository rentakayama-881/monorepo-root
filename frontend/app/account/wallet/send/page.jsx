"use client";
import useSendTransfer from "./useSendTransfer";
import SendRecipientStep from "./components/SendRecipientStep";
import SendAmountStep from "./components/SendAmountStep";
import SendConfirmStep from "./components/SendConfirmStep";

export default function SendMoneyPage() {
  const {
    step,
    setStep,
    loading,
    searching,
    error,
    wallet,
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedUser,
    amount,
    setAmount,
    holdDays,
    setHoldDays,
    description,
    setDescription,
    pin,
    setPin,
    handleSelectUser,
    handleAmountNext,
    handleSubmit,
    handleChangeUser,
  } = useSendTransfer();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Kirim Dana</h1>
          <p className="text-sm text-muted-foreground">
            Transfer uang ke pengguna lain dengan sistem escrow
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`h-1 w-16 ${step > s ? "bg-primary" : "bg-muted/50"}`} />}
            </div>
          ))}
        </div>

        {/* Current Balance */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Available Balance</div>
          <div className="text-xl font-bold text-foreground">
            Rp {wallet.balance.toLocaleString("id-ID")}
          </div>
        </div>

        {step === 1 && (
          <SendRecipientStep
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searching={searching}
            searchResults={searchResults}
            onSelectUser={handleSelectUser}
          />
        )}

        {step === 2 && (
          <SendAmountStep
            selectedUser={selectedUser}
            amount={amount}
            onAmountChange={setAmount}
            holdDays={holdDays}
            onHoldDaysChange={setHoldDays}
            description={description}
            onDescriptionChange={setDescription}
            error={error}
            onNext={handleAmountNext}
            onBack={() => setStep(1)}
            onChangeUser={handleChangeUser}
          />
        )}

        {step === 3 && (
          <SendConfirmStep
            selectedUser={selectedUser}
            amount={amount}
            holdDays={holdDays}
            description={description}
            pin={pin}
            onPinChange={setPin}
            error={error}
            loading={loading}
            onSubmit={handleSubmit}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
