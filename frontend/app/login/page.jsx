"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-sm text-[rgb(var(--muted))]">Memuat formulir…</div>}>
      <LoginForm />
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

  const registeredNotice = searchParams.get("registered") === "1";
  const sessionExpired = searchParams.get("session") === "expired";

  const inputClass =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))]";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-[rgb(var(--brand))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]";

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

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">Masuk ke Alephdraad</h1>
        <p className="text-sm text-[rgb(var(--muted))]">Gunakan email dan password Anda untuk melanjutkan.</p>
      </div>

      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
        {sessionExpired && (
          <div className="mb-4 rounded-md border border-[rgb(var(--warning-border))] bg-[rgb(var(--warning-bg))] px-3 py-2 text-sm text-[rgb(var(--warning))]">
            Session Anda telah berakhir. Silakan login kembali.
          </div>
        )}
        {registeredNotice && (
          <div className="mb-4 rounded-md border border-[rgb(var(--success-border))] bg-[rgb(var(--success-bg))] px-3 py-2 text-sm text-[rgb(var(--success))]">
            Registrasi berhasil. Silahkan periksa kotak masuk Email, Email verifikasi mungkin akan masuk lebih lama, tunggu sekitar 5-10 menit.
          </div>
        )}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--fg))]">Email</label>
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
            <label className="text-sm font-medium text-[rgb(var(--fg))]">Password</label>
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
            <Link href="/forgot-password" className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:underline">
              Lupa password?
            </Link>
          </div>
          {error && <div className="text-sm text-[rgb(var(--error))] bg-[rgb(var(--error-bg))] border border-[rgb(var(--error-border))] rounded-md px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>

      <div className="text-center text-sm text-[rgb(var(--muted))]">
        Belum punya akun? <Link href="/register" className="font-medium text-[rgb(var(--fg))] underline">Daftar di sini</Link>
      </div>
    </div>
  );
}
