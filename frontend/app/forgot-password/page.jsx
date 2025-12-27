"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [message, setMessage] = useState("");

  const inputClass =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))]";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-[rgb(var(--brand))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const data = await fetchJson("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      setStatus("success");
      setMessage(data.message || "Jika email terdaftar, tautan reset telah dikirim.");
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">Lupa Password</h1>
        <p className="text-sm text-[rgb(var(--muted))]">
          Masukkan email Anda untuk menerima tautan reset password.
        </p>
      </div>

      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
        {status === "success" ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[rgb(var(--success-border))] bg-[rgb(var(--success-bg))] px-4 py-3 text-sm text-[rgb(var(--success))]">
              {message}
            </div>
            <p className="text-sm text-[rgb(var(--muted))]">
              Cek inbox email Anda. Jika tidak ada, periksa folder spam.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-[rgb(var(--brand))] hover:underline"
            >
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[rgb(var(--fg))]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="email@contoh.com"
              />
            </div>

            {status === "error" && (
              <div className="rounded-md border border-[rgb(var(--error-border))] bg-[rgb(var(--error-bg))] px-3 py-2 text-sm text-[rgb(var(--error))]">
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? "Mengirim..." : "Kirim Link Reset"}
            </button>
          </form>
        )}
      </div>

      <div className="text-center text-sm text-[rgb(var(--muted))]">
        Ingat password Anda?{" "}
        <Link href="/login" className="font-medium text-[rgb(var(--fg))] underline">
          Login
        </Link>
      </div>
    </div>
  );
}
