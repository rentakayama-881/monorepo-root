"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { getValidToken } from "@/lib/tokenRefresh";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import TOTPSetupWizard from "./TOTPSetupWizard";
import TOTPDisableForm from "./TOTPDisableForm";

function TOTPSettingsContent() {
  const API = `${getApiBase()}/api`;
  const router = useRouter();
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
      const token = await getValidToken();
      if (!token) {
        setError("Sesi telah berakhir. Silakan login kembali.");
        setLoading(false);
        return;
      }
      const res = await fetch(`${API}/auth/totp/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat status 2FA");
      const data = await res.json();
      setStatus(data);

      if (data.enabled) {
        const countRes = await fetch(`${API}/auth/totp/backup-codes/count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (countRes.ok) {
          const countData = await countRes.json();
          setBackupCount(countData.count);
        }
      }
    } catch (e) {
      setError(e.message);
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
      const token = await getValidToken();
      if (!token) {
        setError("Sesi telah berakhir. Silakan login kembali.");
        setSetupLoading(false);
        return;
      }
      const res = await fetch(`${API}/auth/totp/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memulai setup 2FA");
      }
      const data = await res.json();
      setSetupData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifyAndEnable(e) {
    e.preventDefault();
    if (!setupCode || setupCode.length !== 6) {
      setError("Masukkan kode 6 digit dari aplikasi authenticator");
      return;
    }

    setError("");
    setSetupLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setError("Sesi telah berakhir. Silakan login kembali.");
        setSetupLoading(false);
        return;
      }
      const res = await fetch(`${API}/auth/totp/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: setupCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kode tidak valid");
      }
      const data = await res.json();

      if (data.backup_codes && data.backup_codes.length > 0) {
        setBackupCodes(data.backup_codes);
        setBackupCount(data.backup_codes.length);
      }

      setSuccess("2FA berhasil diaktifkan! PENTING: Simpan backup codes di bawah sekarang. Codes ini HANYA ditampilkan sekali!");
      setSetupData(null);
      setSetupCode("");
      fetchStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setSetupLoading(false);
    }
  }

  async function disableTOTP(e) {
    e.preventDefault();
    if (!disablePassword || !disableCode) {
      setError("Masukkan password dan kode 2FA");
      return;
    }

    setError("");
    setDisableLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setError("Sesi telah berakhir. Silakan login kembali.");
        setDisableLoading(false);
        return;
      }
      const res = await fetch(`${API}/auth/totp/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menonaktifkan 2FA");
      }
      setSuccess("2FA berhasil dinonaktifkan");
      setShowDisable(false);
      setDisablePassword("");
      setDisableCode("");
      setBackupCodes(null);
      fetchStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setDisableLoading(false);
    }
  }

  function copyBackupCodes() {
    if (!backupCodes) return;
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setSuccess("Backup codes disalin ke clipboard");
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          <span className="text-sm text-muted-foreground">Memuat pengaturan 2FA...</span>
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
            Autentikasi Dua Faktor (2FA)
          </h3>
          <p className="text-sm text-muted-foreground">
            Tambahkan lapisan keamanan ekstra dengan aplikasi authenticator
          </p>
        </div>
        <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
          status.enabled
            ? "border-success/20 bg-success/10 text-success"
            : "border-border bg-muted/60 text-muted-foreground"
        }`}>
          {status.enabled ? "Aktif" : "Tidak Aktif"}
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
            2FA menggunakan aplikasi seperti Google Authenticator, Authy, atau 1Password untuk menghasilkan kode verifikasi.
          </p>
          <Button onClick={startSetup} disabled={setupLoading}>
            {setupLoading ? "Memulai..." : "Aktifkan 2FA"}
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
              Diaktifkan pada: {new Date(status.verified_at).toLocaleDateString("id-ID", { dateStyle: "long" })}
            </p>
          )}

          <div className="p-4 bg-background rounded-[var(--radius)] border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">Backup Codes</h4>
              <span className="text-xs text-muted-foreground">{backupCount} tersisa</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Backup codes dapat digunakan untuk login jika Anda tidak memiliki akses ke aplikasi authenticator.
            </p>

            {backupCodes ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 p-3 bg-secondary rounded font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="text-foreground">{code}</div>
                  ))}
                </div>
                <p className="text-xs text-destructive font-medium">
                  PENTING: Simpan backup codes ini SEKARANG! Codes ini HANYA ditampilkan sekali dan tidak dapat dilihat lagi.
                </p>
                <Button variant="secondary" size="sm" onClick={copyBackupCodes}>
                  Salin ke Clipboard
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Backup codes hanya ditampilkan saat pertama kali mengaktifkan 2FA.
                Jika Anda kehilangan backup codes, nonaktifkan dan aktifkan kembali 2FA untuk mendapatkan codes baru.
              </p>
            )}
          </div>

          <Button variant="danger" onClick={() => setShowDisable(true)}>
            Nonaktifkan 2FA
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
        <span className="text-sm text-muted-foreground">Memuat pengaturan 2FA...</span>
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
