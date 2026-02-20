"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { requireValidTokenOrThrow, readJsonSafe, throwApiError } from "@/lib/authRequest";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import TOTPSetupWizard from "./TOTPSetupWizard";
import TOTPDisableForm from "./TOTPDisableForm";

function TOTPSettingsContent() {
  const API = `${getApiBase()}/api`;
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");

  const [status, setStatus] = useState({ enabled: false, verified_at: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Setup flow state
  const [setupData, setSetupData] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  // Disable flow state
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  // Backup codes state
  const [backupCodes, setBackupCodes] = useState(null);
  const [backupCount, setBackupCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${API}/auth/totp/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await throwApiError(res, "Failed to load 2FA status.");
      }

      const data = await readJsonSafe(res);
      setStatus(data || { enabled: false, verified_at: null });

      if (data?.enabled) {
        const countRes = await fetch(`${API}/auth/totp/backup-codes/count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (countRes.ok) {
          const countData = await readJsonSafe(countRes);
          setBackupCount(countData?.count || 0);
        }
      } else {
        setBackupCount(0);
      }
    } catch (e) {
      setError(e?.message || "Failed to load 2FA status.");
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function startSetup() {
    setError("");
    setSetupLoading(true);
    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${API}/auth/totp/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await throwApiError(res, "Failed to start 2FA setup.");
      }

      const data = await readJsonSafe(res);
      if (!data) {
        throw new Error("Failed to start 2FA setup.");
      }
      setSetupData(data);
    } catch (e) {
      setError(e?.message || "Failed to start 2FA setup.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifyAndEnable(e) {
    e.preventDefault();
    if (!setupCode || setupCode.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError("");
    setSetupLoading(true);
    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${API}/auth/totp/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: setupCode }),
      });
      if (!res.ok) {
        await throwApiError(res, "Invalid code.");
      }

      const data = await readJsonSafe(res);
      if (!data) {
        throw new Error("Invalid code.");
      }

      if (data.backup_codes && data.backup_codes.length > 0) {
        setBackupCodes(data.backup_codes);
        setBackupCount(data.backup_codes.length);
      }

      setSuccess("2FA enabled successfully. Important: Save your backup codes now. They are shown only once.");
      setSetupData(null);
      setSetupCode("");
      await fetchStatus();
    } catch (e) {
      setError(e?.message || "Invalid code.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function disableTOTP(e) {
    e.preventDefault();
    if (!disablePassword || !disableCode) {
      setError("Enter your password and 2FA code.");
      return;
    }

    setError("");
    setDisableLoading(true);
    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${API}/auth/totp/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      if (!res.ok) {
        await throwApiError(res, "Failed to disable 2FA.");
      }
      setSuccess("2FA disabled successfully.");
      setShowDisable(false);
      setDisablePassword("");
      setDisableCode("");
      setBackupCodes(null);
      await fetchStatus();
    } catch (e) {
      setError(e?.message || "Failed to disable 2FA.");
    } finally {
      setDisableLoading(false);
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes) return;
    const text = backupCodes.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Backup codes disalin ke clipboard");
    } catch {
      setError("Failed to copy backup codes.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          <span className="text-sm text-muted-foreground">Loading 2FA settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius)] border bg-card p-6 space-y-4">
      {setup2fa === "true" && !status.enabled && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-warning shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-warning">2FA Diperlukan</p>
              <p className="text-xs text-muted-foreground mt-1">
                Untuk menggunakan fitur wallet (kirim uang, tarik saldo, set PIN), Anda harus mengaktifkan 2FA terlebih dahulu.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Two-Factor Authentication (2FA)
          </h3>
          <p className="text-sm text-muted-foreground">
            Add an extra security layer with an authenticator app
          </p>
        </div>
        <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
          status.enabled
            ? "border-success/20 bg-success/10 text-success"
            : "border-border bg-muted/60 text-muted-foreground"
        }`}>
          {status.enabled ? "Active" : "Inactive"}
        </div>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Setup Flow - Initial */}
      {!status.enabled && !setupData && (
        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-3">
            2FA uses apps such as Google Authenticator, Authy, or 1Password to generate verification codes.
          </p>
          <Button onClick={startSetup} disabled={setupLoading}>
            {setupLoading ? "Starting..." : "Enable 2FA"}
          </Button>
        </div>
      )}

      {/* Setup Wizard - QR Code & Verify */}
      <TOTPSetupWizard
        setupData={setupData}
        setupCode={setupCode}
        onSetupCodeChange={setSetupCode}
        setupLoading={setupLoading}
        onVerify={verifyAndEnable}
        onCancel={() => {
          setSetupData(null);
          setSetupCode("");
        }}
      />

      {/* Already Enabled */}
      {status.enabled && !showDisable && (
        <div className="space-y-4 pt-2">
          {status.verified_at && (
            <p className="text-xs text-muted-foreground">
              Enabled on: {new Date(status.verified_at).toLocaleDateString("id-ID", { dateStyle: "long" })}
            </p>
          )}

          <div className="p-4 bg-background rounded-[var(--radius)] border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">Backup Codes</h4>
              <span className="text-xs text-muted-foreground">{backupCount} remaining</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Backup codes can be used to sign in when you do not have access to your authenticator app.
            </p>

            {backupCodes ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 p-3 bg-secondary rounded font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="text-foreground">{code}</div>
                  ))}
                </div>
                <p className="text-xs text-destructive font-medium">
                  Important: Save these backup codes now. They are displayed only once and cannot be viewed again.
                </p>
                <Button variant="secondary" size="sm" onClick={copyBackupCodes}>
                  Copy to Clipboard
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Backup codes are shown only once when you first enable 2FA.
                If you lose them, disable and re-enable 2FA to generate new codes.
              </p>
            )}
          </div>

          <Button variant="danger" onClick={() => setShowDisable(true)}>
            Disable 2FA
          </Button>
        </div>
      )}

      {/* Disable Flow */}
      {showDisable && (
        <TOTPDisableForm
          disablePassword={disablePassword}
          onPasswordChange={setDisablePassword}
          disableCode={disableCode}
          onCodeChange={setDisableCode}
          disableLoading={disableLoading}
          onDisable={disableTOTP}
          onCancel={() => {
            setShowDisable(false);
            setDisablePassword("");
            setDisableCode("");
          }}
        />
      )}
    </div>
  );
}

function TOTPSettingsLoading() {
  return (
    <div className="rounded-[var(--radius)] border bg-card p-6">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
        <span className="text-sm text-muted-foreground">Loading 2FA settings...</span>
      </div>
    </div>
  );
}

export default function TOTPSettings() {
  return (
    <Suspense fallback={<TOTPSettingsLoading />}>
      <TOTPSettingsContent />
    </Suspense>
  );
}
