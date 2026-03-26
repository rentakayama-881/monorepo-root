"use client";

import { useState, useCallback } from "react";
import { getApiBase } from "@/lib/api";
import { requireValidTokenOrThrow, readJsonSafe, throwApiError } from "@/lib/authRequest";

export function useTOTPApi() {
  const API = `${getApiBase()}/api`;

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
        await throwApiError(res, "Gagal memuat status 2FA.");
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
      setError(e?.message || "Gagal memuat status 2FA.");
    } finally {
      setLoading(false);
    }
  }, [API]);

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
        await throwApiError(res, "Gagal memulai setup 2FA.");
      }

      const data = await readJsonSafe(res);
      if (!data) {
        throw new Error("Gagal memulai setup 2FA.");
      }
      setSetupData(data);
    } catch (e) {
      setError(e?.message || "Gagal memulai setup 2FA.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifyAndEnable(e) {
    e.preventDefault();
    if (!setupCode || setupCode.length !== 6) {
      setError("Masukkan kode 6 digit dari aplikasi autentikator Anda.");
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
        await throwApiError(res, "Kode tidak valid.");
      }

      const data = await readJsonSafe(res);
      if (!data) {
        throw new Error("Kode tidak valid.");
      }

      if (data.backup_codes && data.backup_codes.length > 0) {
        setBackupCodes(data.backup_codes);
        setBackupCount(data.backup_codes.length);
      }

      setSuccess(
        "2FA berhasil diaktifkan. Penting: simpan kode cadangan Anda sekarang karena hanya ditampilkan satu kali."
      );
      setSetupData(null);
      setSetupCode("");
      await fetchStatus();
    } catch (e) {
      setError(e?.message || "Kode tidak valid.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function disableTOTP(e) {
    e.preventDefault();
    if (!disablePassword || !disableCode) {
      setError("Masukkan password dan kode 2FA Anda.");
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
        await throwApiError(res, "Gagal menonaktifkan 2FA.");
      }
      setSuccess("2FA berhasil dinonaktifkan.");
      setShowDisable(false);
      setDisablePassword("");
      setDisableCode("");
      setBackupCodes(null);
      await fetchStatus();
    } catch (e) {
      setError(e?.message || "Gagal menonaktifkan 2FA.");
    } finally {
      setDisableLoading(false);
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes) return;
    const text = backupCodes.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Kode cadangan disalin ke clipboard.");
    } catch {
      setError("Gagal menyalin kode cadangan.");
    }
  }

  return {
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
  };
}
