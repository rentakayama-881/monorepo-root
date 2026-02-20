"use client";

import { Suspense, useEffect } from "react";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import { useRouter, useSearchParams } from "next/navigation";

function SecurityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    const params = new URLSearchParams();
    if (setup2fa) params.set("setup2fa", setup2fa);
    if (redirect) params.set("redirect", redirect);

    const queryString = params.toString();
    router.replace(`/account${queryString ? `?${queryString}` : ""}`);
  }, [redirect, router, setup2fa]);

  return <AuthPageLoading message="Mengalihkan ke pengaturan keamanan..." />;
}

export default function SecurityPage() {
  return (
    <Suspense fallback={<AuthPageLoading message="Loading..." />}>
      <SecurityContent />
    </Suspense>
  );
}
