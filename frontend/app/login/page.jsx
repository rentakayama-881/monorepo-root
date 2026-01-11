"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson, getApiBase } from "@/lib/api";
import { setTokens, getToken, TOKEN_KEY, AUTH_CHANGED_EVENT } from "@/lib/auth";

// Helper to convert ArrayBuffer to Base64URL
function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Helper to convert Base64URL to ArrayBuffer
function base64URLToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Check if WebAuthn is supported
function isWebAuthnSupported() {
  return typeof window !== "undefined" && !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function"
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page-bg"><div className="text-sm text-muted-foreground">Memuat formulir…</div></div>}>
      <div className="auth-page-bg">
        <LoginForm />
      </div>
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // TOTP state
  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const [totpPending, setTotpPending] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  // Passkey state
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const registeredNotice = searchParams.get("registered") === "1";
  const sessionExpired = searchParams.get("session") === "expired";

  // Listen for auth changes from other tabs (cross-tab sync)
  useEffect(() => {
    // Check if already logged in on mount
    const token = getToken();
    if (token) {
      router.replace("/");
      return;
    }

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === TOKEN_KEY && e.newValue) {
        // Token was set in another tab, redirect to home
        router.replace("/");
      }
    };

    // Listen for auth changes in same tab
    const handleAuthChange = () => {
      const token = getToken();
      if (token) {
        router.replace("/");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, [router]);

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
  }, []);

  const inputClass =
    "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const secondaryButton =
    "w-full inline-flex justify-center items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-60";

  // Passkey login handler
  async function onPasskeyLogin() {
    if (!isWebAuthnSupported()) {
      setError("Browser Anda tidak mendukung Passkey");
      return;
    }

    setPasskeyLoading(true);
    setError("");

    try {
      const API = getApiBase();

      // 1. Begin login - get options (discoverable login, no email needed)
      const beginRes = await fetch(`${API}/api/auth/passkeys/login/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty for discoverable login
      });

      if (!beginRes.ok) {
        const errData = await beginRes.json();
        throw new Error(errData.error || "Gagal memulai login dengan passkey");
      }

      const { options, session_id } = await beginRes.json();
      const publicKeyOptions = options.publicKey;

      // Convert challenge from base64url to ArrayBuffer
      publicKeyOptions.challenge = base64URLToBuffer(publicKeyOptions.challenge);

      // Convert allowCredentials if present
      if (publicKeyOptions.allowCredentials) {
        publicKeyOptions.allowCredentials = publicKeyOptions.allowCredentials.map((cred) => ({
          ...cred,
          id: base64URLToBuffer(cred.id),
        }));
      }

      // 2. Get credential using WebAuthn API
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error("Login dibatalkan");
      }

      // 3. Prepare response for server
      const credentialForServer = {
        id: credential.id,
        rawId: bufferToBase64URL(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: bufferToBase64URL(credential.response.authenticatorData),
          clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
          signature: bufferToBase64URL(credential.response.signature),
        },
      };

      // Add userHandle if present (for discoverable credentials)
      if (credential.response.userHandle) {
        credentialForServer.response.userHandle = bufferToBase64URL(credential.response.userHandle);
      }

      // 4. Finish login - send credential to server
      const finishRes = await fetch(`${API}/api/auth/passkeys/login/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session_id,
          credential: credentialForServer,
        }),
      });

      if (!finishRes.ok) {
        const errData = await finishRes.json();
        throw new Error(errData.error || "Gagal menyelesaikan login");
      }

      const data = await finishRes.json();

      // Success - store tokens
      setTokens(data.AccessToken || data.access_token, data.RefreshToken || data.refresh_token, data.ExpiresIn || data.expires_in);

      // Check if user has username
      const username = data.Username || data.username;
      if (!username || username === "") {
        router.replace("/set-username");
      } else {
        router.replace("/");
      }
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Login dibatalkan atau tidak diizinkan");
      } else {
        setError(err.message || "Gagal login dengan passkey");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await fetchJson(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Check if 2FA is required
      if (data.requires_totp) {
        setRequiresTOTP(true);
        setTotpPending(data.totp_pending);
        setLoading(false);
        return;
      }

      // Handle new token response format
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      
      // Check if user has username, redirect to set-username if not
      if (!data.user?.username || data.user.username === "") {
        router.replace("/set-username");
      } else {
        router.replace("/");
      }

    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function onTOTPSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = useBackupCode ? "/api/auth/login/backup-code" : "/api/auth/login/totp";
      const res = await fetch(`${getApiBase()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totp_pending: totpPending, code: totpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Kode tidak valid");
      }

      // Success - store tokens
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      
      // Check if user has username, redirect to set-username if not
      if (!data.user?.username || data.user.username === "") {
        router.replace("/set-username");
      } else {
        router.replace("/");
      }

    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  // TOTP verification form
  if (requiresTOTP) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 page-enter">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Verifikasi 2FA</h1>
          <p className="text-sm text-muted-foreground">
            Masukkan kode dari aplikasi authenticator Anda
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <form className="space-y-4" onSubmit={onTOTPSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {useBackupCode ? "Backup Code" : "Kode 6 Digit"}
              </label>
              <input
                type="text"
                inputMode={useBackupCode ? "text" : "numeric"}
                pattern={useBackupCode ? undefined : "[0-9]*"}
                maxLength={useBackupCode ? 9 : 6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} font-mono text-center text-lg tracking-widest`}
                placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                autoFocus
              />
            </div>
            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
            <button type="submit" disabled={loading || totpCode.length < (useBackupCode ? 8 : 6)} className={primaryButton}>
              {loading ? "Memverifikasi..." : "Verifikasi"}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setTotpCode("");
                  setError("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {useBackupCode ? "Gunakan kode authenticator" : "Gunakan backup code"}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setRequiresTOTP(false);
                  setTotpPending("");
                  setTotpCode("");
                  setUseBackupCode(false);
                }}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                ← Kembali ke login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 page-enter">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Masuk ke Alephdraad</h1>
        <p className="text-sm text-muted-foreground">Gunakan email dan password Anda untuk melanjutkan.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-soft">{sessionExpired && (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
            Session Anda telah berakhir. Silakan login kembali.
          </div>
        )}
        {registeredNotice && (
          <div className="mb-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            Registrasi berhasil. Silahkan periksa kotak masuk Email, Email verifikasi mungkin akan masuk lebih lama, tunggu sekitar 5-10 menit.
          </div>
        )}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@mail.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Lupa password?
            </Link>
          </div>
          {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {/* Passkey Login Option */}
        {webAuthnSupported && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">atau</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onPasskeyLogin}
              disabled={passkeyLoading || loading}
              className={secondaryButton}
            >
              {passkeyLoading ? (
                <>
                  <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  Masuk dengan Passkey
                </>
              )}
            </button>
          </>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Belum punya akun? <Link href="/register" className="font-medium text-foreground underline">Daftar di sini</Link>
      </div>
    </div>
  );
}
