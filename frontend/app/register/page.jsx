"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const inputClass =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))]";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-[rgb(var(--brand))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]";

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    
    // Validate username is required
    if (!form.username || form.username.trim() === "") {
      setError("Username wajib diisi");
      setLoading(false);
      return;
    }
    
    try {
      const payload = {
        email: form.email,
        password: form.password,
        username: form.username,
        full_name: form.full_name || undefined,
      };
      const data = await fetchJson(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
        <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">Buat akun</h1>
        <p className="text-sm text-[rgb(var(--muted))]">Daftar dengan email, pilih username, dan mulai eksplorasi.</p>
      </div>

      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--fg))]">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--fg))]">Password</label>
            <input
              type="password"
              required
              value={form.password}
              minLength={8}
              onChange={(e) => update("password", e.target.value)}
              className={inputClass}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--fg))]">Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              className={inputClass}
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--fg))]">Nama lengkap (opsional)</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              className={inputClass}
              placeholder="Nama panggilan atau lengkap"
            />
          </div>
          {error && <div className="text-sm text-[rgb(var(--error))] bg-[rgb(var(--error-bg))] border border-[rgb(var(--error-border))] rounded-md px-3 py-2">{error}</div>}
          {info && <div className="text-sm text-[rgb(var(--success))] bg-[rgb(var(--success-bg))] border border-[rgb(var(--success-border))] rounded-md px-3 py-2">{info}</div>}
          <button
            type="submit"
            disabled={loading}
            className={primaryButton}
          >
            {loading ? "Mendaftarkan..." : "Daftar"}
          </button>
        </form>
      </div>

      <div className="text-center text-sm text-[rgb(var(--muted))]">
        Sudah punya akun? <Link href="/login" className="font-medium text-[rgb(var(--fg))] underline">Masuk</Link>
      </div>
    </div>
  );
}
