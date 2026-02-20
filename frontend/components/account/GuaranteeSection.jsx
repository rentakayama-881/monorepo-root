import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function GuaranteeSection({
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
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Jaminan Profil</h3>
      <div className="mt-3 space-y-3">
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-foreground">
              {guaranteeAmount > 0 ? (
                <>
                  Jaminan Aktif: <b>Rp {guaranteeAmount.toLocaleString("id-ID")}</b>
                </>
              ) : (
                <span className="text-muted-foreground">Belum ada jaminan aktif.</span>
              )}
            </div>
            {guaranteeLoading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
            )}
          </div>
          {typeof walletBalance === "number" && (
            <div className="mt-1 text-xs text-muted-foreground">
              Saldo tersedia: Rp {walletBalance.toLocaleString("id-ID")}
            </div>
          )}
        </div>

        {guaranteeAmount > 0 ? (
          <form onSubmit={onSubmitReleaseGuarantee} className="space-y-3">
            <Input
              label="PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit"
              value={releaseGuaranteePin}
              onChange={(e) => setReleaseGuaranteePin(e.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={guaranteeReleasing} loading={guaranteeReleasing}>
              Lepaskan Jaminan
            </Button>
            <div className="text-xs text-muted-foreground">Untuk mengubah jumlah jaminan, lepaskan dulu lalu set ulang.</div>
          </form>
        ) : (
          <form onSubmit={onSubmitSetGuarantee} className="space-y-3">
            <Input
              label="Jumlah Jaminan (IDR)"
              type="number"
              min={100000}
              step={1000}
              placeholder="100000"
              value={setGuaranteeAmountInput}
              onChange={(e) => setSetGuaranteeAmountInput(e.target.value)}
            />
            <Input
              label="PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit"
              value={setGuaranteePin}
              onChange={(e) => setSetGuaranteePin(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              Minimal Rp 100.000
              {typeof walletBalance === "number" ? `, maksimal Rp ${walletBalance.toLocaleString("id-ID")}` : ""}.
            </div>
            <Button type="submit" disabled={guaranteeSubmitting} loading={guaranteeSubmitting}>
              Kunci Jaminan
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
