"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AUTH_CHANGED_EVENT, getToken, TOKEN_KEY } from "@/lib/auth";

export default function useAuthRedirectGuard({ redirectTo = "/" } = {}) {
  const router = useRouter();

  useEffect(() => {
    const redirectIfAuthenticated = () => {
      const token = getToken();
      if (!token) return false;
      router.replace(redirectTo);
      return true;
    };

    if (redirectIfAuthenticated()) {
      return undefined;
    }

    const handleStorageChange = (event) => {
      if (event.key === TOKEN_KEY && event.newValue) {
        redirectIfAuthenticated();
      }
    };

    const handleAuthChanged = () => {
      redirectIfAuthenticated();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, [redirectTo, router]);
}
