"use client";

import { useState, useMemo } from "react";
import { getApiBase } from "@/lib/api";
import { getValidToken } from "@/lib/tokenRefresh";

// Regex untuk validasi username: huruf kecil, angka, underscore. Min 7, max 30
const usernameRegex = /^[a-z0-9_]{7,30}$/;

export default function SetUsernamePage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Validasi realtime
  const validation = useMemo(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return { valid: false, message: "", show: false };
    
    if (trimmed.length < 7) {
      return { valid: false, message: `${7 - trimmed.length} karakter lagi dibutuhkan`, show: true };
    }
    if (trimmed.length > 30) {
      return { valid: false, message: "Username terlalu panjang (maks 30 karakter)", show: true };
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      return { valid: false, message: "Hanya boleh huruf kecil, angka, dan underscore", show: true };
    }
    if (usernameRegex.test(trimmed)) {
      return { valid: true, message: "Username tersedia", show: true };
    }
    return { valid: false, message: "Format tidak valid", show: true };
  }, [username]);

  // Auto-lowercase saat mengetik
  function handleUsernameChange(e) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(value);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmed = username.trim().toLowerCase();
    
    if (!validation.valid) {
      setError(validation.message || "Username tidak valid");
      return;
    }

    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setError("Sesi telah berakhir. Silakan login kembali.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${getApiBase()}/api/auth/username`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t);
          throw new Error(j.error || t || "Failed to save username");
        } catch (_) {
          throw new Error(t || "Failed to save username");
        }
      }

      setSuccess("Username berhasil dibuat. Anda bisa mulai menggunakan fitur penuh.");
      setUsername("");
    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 border border-border rounded-lg bg-card p-6">
      <h2 className="text-xl font-semibold text-foreground">Lengkapi Username</h2>
      <p className="text-sm text-muted-foreground">Buat username publik. Cukup satu langkah.</p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Username</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="username_kamu"
              required
              maxLength={30}
              className="w-full rounded-lg border border-border bg-card pl-8 pr-10 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {validation.show && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${validation.valid ? "text-success" : "text-destructive"}`}>
                {validation.valid ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
            )}
          </div>
          
          {/* Hint / Validation Message */}
          <div className="mt-1.5 flex items-center justify-between">
            <p className={`text-xs ${validation.show ? (validation.valid ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>
              {validation.show ? validation.message : "Huruf kecil, angka, underscore. Min 7 karakter."}
            </p>
            <span className="text-xs text-muted-foreground">
              {username.length}/30
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !validation.valid}
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
        >
          {loading ? "Menyimpan..." : "Simpan Username"}
        </button>
      </form>

      {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
      {success && <div className="mt-3 text-sm text-success">{success}</div>}
    </div>
  );
}
