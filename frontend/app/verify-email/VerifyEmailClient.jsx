"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("Memeriksa token...");

  // Resend state
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("idle"); // idle | loading | success | error
  const [resendMessage, setResendMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token verifikasi tidak ditemukan.");
      return;
    }

    let cancelled = false;
    setStatus("pending");
    setMessage("Memverifikasi token...");

    fetchJson(`/api/auth/verify/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        if (cancelled) return;

        setStatus("success");
        setMessage(data.message || "Email verified successfully. You may now sign in.");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err?.message || "Token tidak valid");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async (e) => {
    e.preventDefault();

    if (!resendEmail || cooldown > 0) return;

    setResendStatus("loading");
    setResendMessage("");

    try {
      const data = await fetchJson("/api/auth/verify/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      setResendStatus("success");
      setResendMessage(data.message || "Email verifikasi telah dikirim ulang.");
      setCooldown(60); // 60 second cooldown
    } catch (err) {
      setResendStatus("error");
      if (err?.code === "RATE001") {
        setResendMessage("Too many requests. Please wait a moment before trying again.");
        setCooldown(60);
      } else {
        setResendMessage(err?.message || "Failed to send verification email.");
      }
    }
  };

  const styles = {
    pending: "bg-warning/10 border-warning/20 text-warning",
    success: "bg-success/10 border-success/20 text-success",
    error: "bg-destructive/10 border-destructive/20 text-destructive",
  };

  const resendStyles = {
    idle: "",
    loading: "",
    success: "bg-success/10 border-success/20 text-success",
    error: "bg-destructive/10 border-destructive/20 text-destructive",
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Verification status */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">Verifikasi Email</h1>

        <div className={`rounded-md border px-4 py-3 text-sm ${styles[status] || styles.pending}`}>
          {message}
        </div>

        {status === "success" && (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline"
          >
            Lanjut ke halaman login →
          </Link>
        )}
      </div>

      {/* Resend verification form */}
      {status === "error" && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Kirim Ulang Email Verifikasi
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan email Anda untuk mendapatkan link verifikasi baru.
            </p>
          </div>

          <form onSubmit={handleResend} className="space-y-3">
            <Input
              type="email"
              label="Email"
              placeholder="email@contoh.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              disabled={resendStatus === "loading" || cooldown > 0}
              className="w-full"
            >
              {resendStatus === "loading" ? (
                "Mengirim..."
              ) : cooldown > 0 ? (
                `Tunggu ${cooldown} detik`
              ) : (
                "Kirim Ulang Email"
              )}
            </Button>
          </form>

          {resendMessage && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                resendStyles[resendStatus] || ""
              }`}
            >
              {resendMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
