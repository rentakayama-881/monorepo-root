"use client";

import Button from "./ui/Button";
import Input from "./ui/Input";

export default function TOTPSetupWizard({
  setupData,
  setupCode,
  onSetupCodeChange,
  setupLoading,
  onVerify,
  onCancel,
}) {
  if (!setupData) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="p-4 bg-background rounded-[var(--radius)] border">
        <p className="text-sm text-foreground mb-3">
          1. Scan QR code berikut dengan aplikasi authenticator:
        </p>
        <div className="flex justify-center mb-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_code_url)}`}
            alt="TOTP QR Code"
            className="rounded-[var(--radius)] border"
            width={200}
            height={200}
          />
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Or enter this code manually:
        </p>
        <code className="block p-2 bg-secondary rounded text-sm font-mono text-foreground break-all select-all">
          {setupData.secret}
        </code>
      </div>

      <form onSubmit={onVerify} className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            2. Enter the 6-digit code from your app:
          </label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={setupCode}
            onChange={(e) => onSetupCodeChange(e.target.value.replace(/\D/g, ""))}
            className="font-mono text-center text-lg tracking-widest"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={setupLoading || setupCode.length !== 6}>
            {setupLoading ? "Verifying..." : "Verify & Enable"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
