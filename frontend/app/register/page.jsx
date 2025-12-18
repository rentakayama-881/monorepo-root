"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { setToken } from "@/lib/auth";

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
      if (data.token) {
        setToken(data.token);
        router.replace("/");
        return;
      }
      setInfo("Registrasi berhasil. Cek email untuk verifikasi lalu lanjutkan login.");
      setForm({ email: "", password: "", username: "", full_name: "" });
      setTimeout(() => router.replace("/login?registered=1"), 600);
    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Buat akun</h1>
        <p className="text-sm text-slate-600">Daftar dengan email, pilih username (opsional), dan mulai eksplorasi.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Password</label>
            <input
              type="password"
              required
              value={form.password}
              minLength={8}
              onChange={(e) => update("password", e.target.value)}
              className="input"
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Username (opsional)</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              className="input"
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Nama lengkap (opsional)</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              className="input"
              placeholder="Nama panggilan atau lengkap"
            />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          {info && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{info}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center btn text-sm"
          >
            {loading ? "Mendaftarkan..." : "Daftar"}
          </button>
        </form>
      </div>

      <div className="text-center text-sm text-slate-700">
        Sudah punya akun? <Link href="/login" className="text-blue-700 hover:underline">Masuk</Link>
      </div>
    </div>
  );
}
