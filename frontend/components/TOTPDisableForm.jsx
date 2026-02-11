"use client";

import Button from "./ui/Button";
import Input from "./ui/Input";

export default function TOTPDisableForm({
  disablePassword,
  onPasswordChange,
  disableCode,
  onCodeChange,
  disableLoading,
  onDisable,
  onCancel,
}) {
  return (
    <form onSubmit={onDisable} className="space-y-4 pt-2">
      <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
        <p className="text-sm text-destructive mb-3">
          Menonaktifkan 2FA akan mengurangi keamanan akun Anda. Pastikan Anda yakin ingin melanjutkan.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Password
            </label>
            <Input
              type="password"
              placeholder="Masukkan password Anda"
              value={disablePassword}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Kode 2FA
            </label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ""))}
              className="font-mono"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="danger"
          disabled={disableLoading || !disablePassword || disableCode.length !== 6}
        >
          {disableLoading ? "Menonaktifkan..." : "Nonaktifkan 2FA"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
