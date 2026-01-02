"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { getApiBase } from "@/lib/api";

// Sudo Context for global state management
const SudoContext = createContext(null);

export function useSudo() {
  const context = useContext(SudoContext);
  if (!context) {
    throw new Error("useSudo must be used within a SudoProvider");
  }
  return context;
}

// Storage keys
const SUDO_TOKEN_KEY = "sudo_token";
const SUDO_EXPIRES_KEY = "sudo_expires";

// Sudo Provider Component
export function SudoProvider({ children }) {
  const [sudoToken, setSudoToken] = useState(null);
  const [sudoExpires, setSudoExpires] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [requiresTOTP, setRequiresTOTP] = useState(false);

  // Load sudo token from storage on mount
  useEffect(() => {
    const token = localStorage.getItem(SUDO_TOKEN_KEY);
    const expires = localStorage.getItem(SUDO_EXPIRES_KEY);
    if (token && expires) {
      const expiresAt = new Date(expires);
      if (expiresAt > new Date()) {
        setSudoToken(token);
        setSudoExpires(expiresAt);
      } else {
        // Expired, clear storage
        localStorage.removeItem(SUDO_TOKEN_KEY);
        localStorage.removeItem(SUDO_EXPIRES_KEY);
      }
    }
  }, []);

  // Check if sudo is active
  const isSudoActive = useCallback(() => {
    if (!sudoToken || !sudoExpires) return false;
    return new Date() < sudoExpires;
  }, [sudoToken, sudoExpires]);

  // Store sudo token
  const storeSudoToken = useCallback((token, expiresAt) => {
    setSudoToken(token);
    setSudoExpires(new Date(expiresAt));
    localStorage.setItem(SUDO_TOKEN_KEY, token);
    localStorage.setItem(SUDO_EXPIRES_KEY, expiresAt);
  }, []);

  // Clear sudo token
  const clearSudoToken = useCallback(() => {
    setSudoToken(null);
    setSudoExpires(null);
    localStorage.removeItem(SUDO_TOKEN_KEY);
    localStorage.removeItem(SUDO_EXPIRES_KEY);
  }, []);

  // Request sudo mode - returns promise that resolves when sudo is granted
  const requestSudo = useCallback((action) => {
    return new Promise((resolve, reject) => {
      if (isSudoActive()) {
        resolve(sudoToken);
        return;
      }
      setPendingAction({ resolve, reject, action });
      setShowModal(true);
    });
  }, [isSudoActive, sudoToken]);

  // Handle sudo verification success
  const onSudoSuccess = useCallback((token, expiresAt) => {
    storeSudoToken(token, expiresAt);
    if (pendingAction) {
      pendingAction.resolve(token);
      setPendingAction(null);
    }
    setShowModal(false);
  }, [storeSudoToken, pendingAction]);

  // Handle sudo verification cancel
  const onSudoCancel = useCallback(() => {
    if (pendingAction) {
      pendingAction.reject(new Error("Verifikasi dibatalkan"));
      setPendingAction(null);
    }
    setShowModal(false);
  }, [pendingAction]);

  // Fetch sudo status (to check if TOTP required)
  const fetchSudoStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${getApiBase()}/api/auth/sudo/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Sudo-Token": sudoToken || "",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRequiresTOTP(data.requires_totp);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch sudo status:", err);
    }
    return null;
  }, [sudoToken]);

  const value = {
    sudoToken,
    sudoExpires,
    isSudoActive,
    requestSudo,
    clearSudoToken,
    fetchSudoStatus,
    requiresTOTP,
  };

  return (
    <SudoContext.Provider value={value}>
      {children}
      {showModal && (
        <SudoModal
          onSuccess={onSudoSuccess}
          onCancel={onSudoCancel}
          actionDescription={pendingAction?.action}
          requiresTOTP={requiresTOTP}
          onCheckStatus={fetchSudoStatus}
        />
      )}
    </SudoContext.Provider>
  );
}

// Sudo Modal Component
function SudoModal({ onSuccess, onCancel, actionDescription, requiresTOTP: initialRequiresTOTP, onCheckStatus }) {
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresTOTP, setRequiresTOTP] = useState(initialRequiresTOTP);
  const [checking, setChecking] = useState(true);

  // Check sudo status on mount
  useEffect(() => {
    async function checkStatus() {
      setChecking(true);
      const status = await onCheckStatus();
      if (status) {
        setRequiresTOTP(status.requires_totp);
      }
      setChecking(false);
    }
    checkStatus();
  }, [onCheckStatus]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
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

      const res = await fetch(`${getApiBase()}/api/auth/sudo/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verifikasi gagal");
      }

      onSuccess(data.sudo_token, data.expires_at);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))]";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-[rgb(var(--brand))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--warning-bg))]">
              <svg className="h-5 w-5 text-[rgb(var(--warning))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[rgb(var(--fg))]">Konfirmasi Identitas</h3>
              <p className="text-sm text-[rgb(var(--muted))]">
                {actionDescription || "Aksi ini memerlukan verifikasi ulang"}
              </p>
            </div>
          </div>

          {checking ? (
            <div className="flex items-center justify-center py-8">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[rgb(var(--brand))] border-t-transparent" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[rgb(var(--fg))]">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Masukkan password Anda"
                  autoFocus
                />
              </div>

              {requiresTOTP && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[rgb(var(--fg))]">
                    {useBackupCode ? "Backup Code" : "Kode 2FA"}
                  </label>
                  <input
                    type="text"
                    inputMode={useBackupCode ? "text" : "numeric"}
                    pattern={useBackupCode ? undefined : "[0-9]*"}
                    maxLength={useBackupCode ? 9 : 6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ""))}
                    className={`${inputClass} font-mono text-center tracking-widest`}
                    placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setTotpCode("");
                    }}
                    className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:underline"
                  >
                    {useBackupCode ? "Gunakan kode authenticator" : "Gunakan backup code"}
                  </button>
                </div>
              )}

              {error && (
                <div className="text-sm text-[rgb(var(--error))] bg-[rgb(var(--error-bg))] border border-[rgb(var(--error-border))] rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 inline-flex justify-center items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-semibold text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || !password || (requiresTOTP && totpCode.length < (useBackupCode ? 8 : 6))}
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

              <p className="text-xs text-center text-[rgb(var(--muted))]">
                Sesi sudo berlaku selama 15 menit
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// HOC for wrapping components that need sudo protection
export function withSudoProtection(WrappedComponent, actionDescription) {
  return function SudoProtectedComponent(props) {
    const { requestSudo, sudoToken, isSudoActive } = useSudo();

    const executeSudoAction = async (action) => {
      try {
        const token = await requestSudo(actionDescription);
        return action(token);
      } catch (err) {
        throw err;
      }
    };

    return (
      <WrappedComponent
        {...props}
        sudoToken={sudoToken}
        isSudoActive={isSudoActive}
        executeSudoAction={executeSudoAction}
      />
    );
  };
}

// Hook for executing sudo-protected actions
export function useSudoAction(actionDescription) {
  const { requestSudo, sudoToken, isSudoActive } = useSudo();

  const execute = useCallback(async (action) => {
    try {
      const token = await requestSudo(actionDescription);
      return await action(token);
    } catch (err) {
      throw err;
    }
  }, [requestSudo, actionDescription]);

  return {
    execute,
    sudoToken,
    isSudoActive,
  };
}

export default SudoModal;
