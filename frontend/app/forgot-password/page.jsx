"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/api";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthContainer,
  AuthField,
  AuthHeader,
  AuthNotice,
} from "@/components/auth/AuthPrimitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [message, setMessage] = useState("");

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
    <div className="auth-page-bg relative">
      <AuthContainer>
        <AuthHeader
          title="Lupa Password"
          description="Masukkan email Anda untuk menerima tautan reset password."
        />

        {status === "success" ? (
          <div className="space-y-4">
            <AuthNotice variant="success">{message}</AuthNotice>
            <p className="text-sm text-muted-foreground">
              Cek inbox email Anda. Jika tidak ada, periksa folder spam.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-primary hover:underline"
            >
              Kembali ke halaman masuk
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <AuthField label="Email" htmlFor="forgot-email">
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="email@contoh.com"
              />
            </AuthField>

            {status === "error" && <AuthNotice variant="error">{message}</AuthNotice>}

            <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASS}>
              {loading ? "Mengirim..." : "Kirim Link Reset"}
            </button>
          </form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          Ingat password Anda?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Masuk
          </Link>
        </div>
      </AuthContainer>
    </div>
  );
}
