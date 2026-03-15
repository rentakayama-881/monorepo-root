"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

const WALLET_ENTRY_ROUTE = "/account/wallet/transactions";

export default function WalletPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(WALLET_ENTRY_ROUTE)}`);
      return;
    }

    router.replace(WALLET_ENTRY_ROUTE);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="sr-only">Redirecting</span>
    </div>
  );
}
