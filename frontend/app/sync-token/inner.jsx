"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function sanitizeNextPath(next) {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\") || next.startsWith("\\\\")) return "/";
  if (next.length > 2048) return "/";
  return next;
}

function sanitizeJwtLikeToken(token) {
  if (typeof token !== "string") return null;
  if (token.length < 20 || token.length > 4096) return null;
  const jwtLike = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (!jwtLike.test(token)) return null;
  return token;
}

export default function InnerSyncTokenPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = sanitizeNextPath(params.get("next") || "/");
  const isProd = process.env.NODE_ENV === "production";
  const token = isProd ? null : sanitizeJwtLikeToken(params.get("token"));

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem("token", token);
      }
    } catch (e) {
      // ignore storage errors (private mode, etc.)
    }

    const t = setTimeout(() => {
      router.replace(next);
    }, 400);

    return () => clearTimeout(t);
  }, [token, next, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 text-sm text-muted-foreground">
      Menyimpan token ke browser...
    </div>
  );
}
