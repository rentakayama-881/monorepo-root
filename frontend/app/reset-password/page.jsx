"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import { fetchJson } from "@/lib/api";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthContainer,
  AuthField,
  AuthHeader,
  AuthNotice,
} from "@/components/auth/AuthPrimitives";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthPageLoading fullPage={false} message="Memuat reset password" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Password tidak cocok.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const data = await fetchJson("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      setStatus("success");
      setMessage(data.message || "Password berhasil direset.");

      setTimeout(() => {
        router.push("/login?reset=1");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Gagal mengatur ulang password. Token mungkin sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page-bg relative">
        <AuthContainer>
          <AuthNotice variant="error">Token reset password tidak ditemukan.</AuthNotice>
          <Link
            href="/forgot-password"
            className="block text-center text-sm font-medium text-primary hover:underline"
          >
            Minta link reset baru
          </Link>
        </AuthContainer>
      </div>
    );
  }

  return (
    <div className="auth-page-bg relative">
      <AuthContainer>
        <AuthHeader title="Atur Ulang Password" description="Masukkan password baru Anda." />

        {status === "success" ? (
          <div className="space-y-4">
            <AuthNotice variant="success">{message}</AuthNotice>
            <p className="text-sm text-muted-foreground">Mengalihkan ke halaman masuk...</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <AuthField label="Password Baru" htmlFor="reset-password">
              <input
                id="reset-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="Minimal 8 karakter"
              />
            </AuthField>

            <AuthField label="Konfirmasi Password" htmlFor="reset-confirm">
              <input
                id="reset-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="Ulangi password baru"
              />
            </AuthField>

            {status === "error" && <AuthNotice variant="error">{message}</AuthNotice>}

            <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASS}>
              {loading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline">
            Kembali ke halaman masuk
          </Link>
        </div>
      </AuthContainer>
    </div>
  );
}
