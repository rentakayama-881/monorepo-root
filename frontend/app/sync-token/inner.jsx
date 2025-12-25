"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function InnerSyncTokenPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const next = params.get("next") || "/";

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
  }, [token, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 text-sm text-[rgb(var(--muted))]">
      Menyimpan token ke browser...
    </div>
  );
}
