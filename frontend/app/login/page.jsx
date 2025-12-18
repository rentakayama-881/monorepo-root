"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-sm text-neutral-600">Memuat formulir…</div>}>
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

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal masuk. Periksa email/password.");
      }

      setToken(data.token);
      router.replace("/");

    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Masuk ke Ballerina</h1>
        <p className="text-sm text-slate-600">Gunakan email dan password Anda untuk melanjutkan.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        {registeredNotice && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Registrasi berhasil. Verifikasi email Anda lalu masuk.
          </div>
        )}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center btn text-sm"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>

      <div className="text-center text-sm text-slate-700">
        Belum punya akun? <Link href="/register" className="text-blue-700 hover:underline">Daftar di sini</Link>
      </div>
    </div>
  );
}
