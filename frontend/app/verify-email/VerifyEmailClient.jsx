"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiBase } from "@/lib/api";

export default function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("Memeriksa token...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token verifikasi tidak ditemukan.");
      return;
    }

    let cancelled = false;
    setStatus("pending");
    setMessage("Memverifikasi token...");

    fetch(`${getApiBase()}/api/auth/verify/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Gagal memverifikasi email");
        if (cancelled) return;

        setStatus("success");
        setMessage(data.message || "Email berhasil diverifikasi. Silakan login.");
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

  const styles = {
    pending: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Verifikasi Email</h1>

        <div className={`rounded-md border px-4 py-3 text-sm ${styles[status] || styles.pending}`}>
          {message}
        </div>

        {status === "success" && (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            Lanjut ke halaman login →
          </Link>
        )}
      </div>
    </div>
  );
}
