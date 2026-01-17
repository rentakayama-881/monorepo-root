"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SecurityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    // Redirect to account page with setup2fa param
    // The TOTPSettings component on account page will handle the 2FA setup
    const params = new URLSearchParams();
    if (setup2fa) params.set("setup2fa", setup2fa);
    if (redirect) params.set("redirect", redirect);
    
    const queryString = params.toString();
    router.replace(`/account${queryString ? "?" + queryString : ""}`);
  }, [router, setup2fa, redirect]);

  return (
    <main className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">Mengalihkan ke pengaturan keamanan...</p>
        </div>
      </div>
    </main>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <SecurityContent />
    </Suspense>
  );
}
