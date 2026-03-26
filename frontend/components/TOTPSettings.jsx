"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import TOTPSetupWizard from "./TOTPSetupWizard";
import TOTPDisableForm from "./TOTPDisableForm";
import { SectionLoadingBlock } from "./ui/LoadingState";
import { useTOTPApi } from "./useTOTPApi";

function TOTPSettingsContent() {
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");

  const {
    status,
    loading,
    error,
    setError,
    success,
    setSuccess,
    setupData,
    setSetupData,
    setupCode,
    setSetupCode,
    setupLoading,
    showDisable,
    setShowDisable,
    disablePassword,
    setDisablePassword,
    disableCode,
    setDisableCode,
    disableLoading,
    backupCodes,
    backupCount,
    fetchStatus,
    startSetup,
    verifyAndEnable,
    disableTOTP,
    copyBackupCodes,
  } = useTOTPApi();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <section className="settings-section">
        <h3 className="settings-section-title mb-3">Autentikasi 2 Faktor (2FA)</h3>
        <SectionLoadingBlock lines={3} compact srLabel="Memuat pengaturan 2FA" />
      </section>
    );
  }

  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Autentikasi 2 Faktor (2FA)</h3>
      {setup2fa === "true" && !status.enabled && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-warning shrink-0 mt-0.5"
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
            <div>
              <p className="text-sm font-medium text-warning">2FA Diperlukan</p>
              <p className="text-xs text-muted-foreground mt-1">
                Untuk menggunakan fitur wallet (kirim uang, tarik saldo, set PIN), Anda harus
                mengaktifkan 2FA terlebih dahulu.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Autentikasi 2 Faktor (2FA)</h3>
          <p className="text-sm text-muted-foreground">
            Tambahkan lapisan keamanan ekstra dengan aplikasi autentikator
          </p>
        </div>
        <div
          className={`inline-flex items-center rounded-sm border px-2 py-1 text-xs font-medium ${
            status.enabled
              ? "border-success/20 bg-success/10 text-success"
              : "border-border bg-muted/60 text-muted-foreground"
          }`}
        >
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
            2FA menggunakan aplikasi seperti Google Authenticator, Authy, atau 1Password untuk
            menghasilkan kode verifikasi.
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
              Diaktifkan pada:{" "}
              {new Date(status.verified_at).toLocaleDateString("id-ID", { dateStyle: "long" })}
            </p>
          )}

          <div className="p-4 bg-background rounded-[var(--radius)] border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">Kode Cadangan</h4>
              <span className="text-xs text-muted-foreground">{backupCount} tersisa</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Kode cadangan dapat digunakan untuk login saat Anda tidak memiliki akses ke aplikasi
              autentikator.
            </p>

            {backupCodes ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 p-3 bg-secondary rounded font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="text-foreground">
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-destructive font-medium">
                  Penting: simpan kode cadangan ini sekarang. Kode hanya ditampilkan satu kali dan
                  tidak dapat dilihat lagi.
                </p>
                <Button variant="secondary" size="sm" onClick={copyBackupCodes}>
                  Salin ke Clipboard
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Kode cadangan hanya ditampilkan satu kali saat Anda pertama kali mengaktifkan 2FA.
                Jika hilang, nonaktifkan lalu aktifkan kembali 2FA untuk membuat kode baru.
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
    </section>
  );
}

function TOTPSettingsLoading() {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Autentikasi 2 Faktor (2FA)</h3>
      <SectionLoadingBlock lines={3} compact srLabel="Memuat pengaturan 2FA" />
    </section>
  );
}

export default function TOTPSettings() {
  return (
    <Suspense fallback={<TOTPSettingsLoading />}>
      <TOTPSettingsContent />
    </Suspense>
  );
}
