"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { getValidToken } from "@/lib/tokenRefresh";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Alert from "./ui/Alert";

function TOTPSettingsContent() {
  const API = `${getApiBase()}/api`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");
  const redirectUrl = searchParams.get("redirect");

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

  // Fetch TOTP status
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

      // If enabled, also fetch backup code count
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

  // NOTE: Don't auto-start setup - let user click "Aktifkan 2FA" button
  // The info banner will inform user why they need to enable 2FA

  // Start TOTP setup
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

  // Verify and enable TOTP
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

      // Get backup codes from response (only shown once!)
      if (data.backup_codes && data.backup_codes.length > 0) {
        setBackupCodes(data.backup_codes);
        setBackupCount(data.backup_codes.length);
      }

      setSuccess("2FA berhasil diaktifkan! PENTING: Simpan backup codes di bawah sekarang. Codes ini HANYA ditampilkan sekali!");
      setSetupData(null);
      setSetupCode("");
      fetchStatus();

      // NOTE: Backup codes are now returned from verify endpoint
      // No need to call generateBackupCodes() separately

      // NOTE: Do NOT auto-redirect after 2FA setup
      // User should stay on this page to save backup codes
      // User will manually navigate back to wallet/send when ready
    } catch (e) {
      setError(e.message);
    } finally {
      setSetupLoading(false);
    }
  }

  // Disable TOTP
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

  // NOTE: generateBackupCodes removed - backup codes are now only generated during TOTP enable
  // and returned in the verify response. This is more secure as it prevents attackers
  // from regenerating codes if they gain access to a logged-in session.

  // Copy backup codes to clipboard
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
      {/* Show info banner if redirected for 2FA setup */}
      {setup2fa === "true" && !status.enabled && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                2FA Diperlukan
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
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
        <div className={`px-2 py-1 rounded text-xs font-medium ${status.enabled ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"}`}>
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

      {/* Setup Flow */}
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

      {/* QR Code & Setup */}
      {setupData && (
        <div className="space-y-4 pt-2">
          <div className="p-4 bg-background rounded-[var(--radius)] border">
            <p className="text-sm text-foreground mb-3">
              1. Scan QR code berikut dengan aplikasi authenticator:
            </p>
            <div className="flex justify-center mb-4">
              {/* QR Code - using external service for simplicity */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_code_url)}`}
                alt="TOTP QR Code"
                className="rounded-[var(--radius)] border"
                width={200}
                height={200}
              />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Atau masukkan kode ini secara manual:
            </p>
            <code className="block p-2 bg-secondary rounded text-sm font-mono text-foreground break-all select-all">
              {setupData.secret}
            </code>
          </div>

          <form onSubmit={verifyAndEnable} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                2. Masukkan kode 6 digit dari aplikasi:
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                className="font-mono text-center text-lg tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={setupLoading || setupCode.length !== 6}>
                {setupLoading ? "Memverifikasi..." : "Verifikasi & Aktifkan"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSetupData(null);
                  setSetupCode("");
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Already Enabled */}
      {status.enabled && !showDisable && (
        <div className="space-y-4 pt-2">
          {status.verified_at && (
            <p className="text-xs text-muted-foreground">
              Diaktifkan pada: {new Date(status.verified_at).toLocaleDateString("id-ID", { dateStyle: "long" })}
            </p>
          )}

          {/* Backup Codes Section */}
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
                  ⚠️ PENTING: Simpan backup codes ini SEKARANG! Codes ini HANYA ditampilkan sekali dan tidak dapat dilihat lagi.
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
        <form onSubmit={disableTOTP} className="space-y-4 pt-2">
          <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
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
                  onChange={(e) => setDisablePassword(e.target.value)}
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
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDisable(false);
                setDisablePassword("");
                setDisableCode("");
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Loading fallback for Suspense
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

// Export with Suspense wrapper to handle useSearchParams
export default function TOTPSettings() {
  return (
    <Suspense fallback={<TOTPSettingsLoading />}>
      <TOTPSettingsContent />
    </Suspense>
  );
}
