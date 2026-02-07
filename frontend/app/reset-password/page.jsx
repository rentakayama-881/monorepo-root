"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Memuat...</div>}>
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

  const inputClass =
    "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login?reset=1");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Failed to reset password. The token may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Token reset password tidak ditemukan.
          </div>
          <Link
            href="/forgot-password"
            className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
          >
            Minta link reset baru
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Reset Password</h1>
        <p className="text-sm text-muted-foreground">Masukkan password baru Anda.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {status === "success" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
              {message}
            </div>
            <p className="text-sm text-muted-foreground">Mengalihkan ke halaman login...</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password Baru</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Konfirmasi Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Ulangi password baru"
              />
            </div>

            {status === "error" && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </form>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline">
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
