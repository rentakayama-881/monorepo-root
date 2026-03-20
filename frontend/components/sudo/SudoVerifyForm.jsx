import { useState, useEffect } from "react";
import { requireValidTokenOrThrow, readJsonSafe, throwApiError } from "@/lib/authRequest";
import { getApiBase } from "@/lib/api";

export default function SudoVerifyForm({
  onSuccess,
  onCancel,
  actionDescription,
  requiresTOTP: initialRequiresTOTP,
  onCheckStatus,
}) {
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresTOTP, setRequiresTOTP] = useState(initialRequiresTOTP || false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      setChecking(true);
      try {
        const status = await onCheckStatus();
        if (!isMounted) return;
        if (status && typeof status.requires_totp === "boolean") {
          setRequiresTOTP(status.requires_totp);
        }
      } catch {
        // Silently fail - status check is non-critical
      }
      if (isMounted) {
        setChecking(false);
      }
    }

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [onCheckStatus]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = await requireValidTokenOrThrow();
      const body = {
        password,
      };
      if (requiresTOTP) {
        if (useBackupCode) {
          body.backup_code = totpCode;
        } else {
          body.totp_code = totpCode;
        }
      }

      const res = await fetch(`${getApiBase()}/api/v1/auth/sudo/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        await throwApiError(res, "Verification failed");
      }

      const data = await readJsonSafe(res);
      if (!data?.sudo_token || !data?.expires_at) {
        throw new Error("Verification failed");
      }

      onSuccess(data.sudo_token, data.expires_at);
    } catch (err) {
      setError(err?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-[var(--radius)] border bg-background shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <svg
                className="h-5 w-5 text-warning"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Konfirmasi Identitas</h3>
              <p className="text-sm text-muted-foreground">
                {actionDescription || "Aksi ini memerlukan verifikasi ulang"}
              </p>
            </div>
          </div>

          {checking ? (
            <div className="flex items-center justify-center py-8">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>

              {requiresTOTP && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {useBackupCode ? "Backup Code" : "Kode 2FA"}
                  </label>
                  <input
                    type="text"
                    inputMode={useBackupCode ? "text" : "numeric"}
                    pattern={useBackupCode ? undefined : "[0-9]*"}
                    maxLength={useBackupCode ? 9 : 6}
                    required
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(
                        useBackupCode ? e.target.value : e.target.value.replace(/\D/g, "")
                      )
                    }
                    className={`${inputClass} font-mono text-center tracking-widest`}
                    placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setTotpCode("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {useBackupCode ? "Use authenticator code" : "Enter 2FA code or backup code"}
                  </button>
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 inline-flex justify-center items-center rounded-md border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !password ||
                    (requiresTOTP && totpCode.length < (useBackupCode ? 8 : 6))
                  }
                  className={primaryButton}
                >
                  {loading ? (
                    <>
                      <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Memverifikasi...
                    </>
                  ) : (
                    "Konfirmasi"
                  )}
                </button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Tindakan ini memiliki batasan
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
