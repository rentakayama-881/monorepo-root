"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        username: form.username || undefined,
        full_name: form.full_name || undefined,
      };
      const res = await fetch(`${getApiBase()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal mendaftar");
      }
      setInfo("Akun dibuat. Cek log server untuk tautan verifikasi email lalu login setelah diverifikasi.");
      setForm({ email: "", password: "", username: "", full_name: "" });
      setTimeout(() => router.push("/login"), 400);
    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-neutral-900">Buat akun</h1>
          <p className="text-sm text-neutral-600">Daftar dengan email, pilih username (opsional), dan mulai eksplorasi.</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm p-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800">Password</label>
              <input
                type="password"
                required
                value={form.password}
                minLength={8}
                onChange={(e) => update("password", e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Minimal 8 karakter"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800">Username (opsional)</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800">Nama lengkap (opsional)</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Nama panggilan atau lengkap"
              />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
            {info && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{info}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-neutral-900 disabled:opacity-60"
            >
              {loading ? "Mendaftarkan..." : "Daftar"}
            </button>
          </form>
        </div>

        <div className="text-center text-sm text-neutral-700">
          Sudah punya akun? <Link href="/login" className="text-blue-700 hover:underline">Masuk</Link>
        </div>
      </div>
    </div>
  );
}
