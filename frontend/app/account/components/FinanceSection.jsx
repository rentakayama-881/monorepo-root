import dynamic from "next/dynamic";

const GuaranteeSection = dynamic(() => import("@/components/account/GuaranteeSection"), {
  loading: () => <div className="h-32 animate-pulse bg-border/30 rounded-lg" />,
});

export default function FinanceSection({
  guaranteeAmount,
  guaranteeLoading,
  walletBalance,
  releaseGuaranteePin,
  setReleaseGuaranteePin,
  setGuaranteeAmountInput,
  setSetGuaranteeAmountInput,
  setGuaranteePin,
  setSetGuaranteePin,
  guaranteeReleasing,
  guaranteeSubmitting,
  onSubmitReleaseGuarantee,
  onSubmitSetGuarantee,
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-1">Keuangan</h2>
      <p className="text-sm text-muted-foreground mb-5">Jaminan profil dan pengaturan keuangan</p>
      <div className="rounded-xl border border-border/60 bg-card/80 px-6">
        <GuaranteeSection
          guaranteeAmount={guaranteeAmount}
          guaranteeLoading={guaranteeLoading}
          walletBalance={walletBalance}
          releaseGuaranteePin={releaseGuaranteePin}
          setReleaseGuaranteePin={setReleaseGuaranteePin}
          setGuaranteeAmountInput={setGuaranteeAmountInput}
          setSetGuaranteeAmountInput={setSetGuaranteeAmountInput}
          setGuaranteePin={setGuaranteePin}
          setSetGuaranteePin={setSetGuaranteePin}
          guaranteeReleasing={guaranteeReleasing}
          guaranteeSubmitting={guaranteeSubmitting}
          onSubmitReleaseGuarantee={onSubmitReleaseGuarantee}
          onSubmitSetGuarantee={onSubmitSetGuarantee}
        />
      </div>
    </section>
  );
}
