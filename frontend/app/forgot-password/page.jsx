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
    "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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
        <h1 className="text-xl font-semibold text-foreground">Lupa Password</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan email Anda untuk menerima tautan reset password.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {status === "success" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
              {message}
            </div>
            <p className="text-sm text-muted-foreground">
              Cek inbox email Anda. Jika tidak ada, periksa folder spam.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-primary hover:underline"
            >
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
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
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? "Mengirim..." : "Kirim Link Reset"}
            </button>
          </form>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Ingat password Anda?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Login
        </Link>
      </div>
    </div>
  );
}
