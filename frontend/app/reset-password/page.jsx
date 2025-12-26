"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-[rgb(var(--muted))]">Memuat...</div>}>
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
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))]";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-md bg-[rgb(var(--brand))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]";

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
      setMessage(err?.message || "Gagal mereset password. Token mungkin sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Token reset password tidak ditemukan.
          </div>
          <Link
            href="/forgot-password"
            className="mt-4 block text-center text-sm font-medium text-[rgb(var(--brand))] hover:underline"
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
        <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">Reset Password</h1>
        <p className="text-sm text-[rgb(var(--muted))]">Masukkan password baru Anda.</p>
      </div>

      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
        {status === "success" ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </div>
            <p className="text-sm text-[rgb(var(--muted))]">Mengalihkan ke halaman login...</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[rgb(var(--fg))]">Password Baru</label>
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
              <label className="text-sm font-medium text-[rgb(var(--fg))]">Konfirmasi Password</label>
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
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </form>
        )}
      </div>

      <div className="text-center text-sm text-[rgb(var(--muted))]">
        <Link href="/login" className="font-medium text-[rgb(var(--fg))] underline">
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
