import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/tokenRefresh";

export default function useProfileSidebar({ onClose, triggerRef }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState({ username: "", avatar_url: "", email: "" });
  const [wallet, setWallet] = useState({ balance: 0, pin_set: false });
  const [guarantee, setGuarantee] = useState({ amount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const panelRef = useRef(null);

  // Lock body scroll
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  // Fetch user data
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadUser() {
      const token = getToken();
      if (!token) {
        onClose?.();
        router.replace("/login");
        return;
      }
      setIsLoading(true);
      setLoadError("");
      try {
        const res = await fetchWithAuth(`${getApiBase()}/api/v1/user/me`, { signal });
        if (res.status === 401) {
          clearToken();
          onClose?.();
          router.replace("/login?session=expired");
          return;
        }
        if (!res.ok) {
          if (!signal.aborted) {
            setLoadError("Profil Anda belum bisa dimuat saat ini. Silakan coba lagi.");
            setIsLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (signal.aborted) return;
        setUser({
          username:
            data.username ||
            data.name ||
            (typeof data.email === "string" ? data.email.split("@")[0] : ""),
          avatar_url: data.avatar_url || "",
          email: data.email || "",
        });

        try {
          const featureBase =
            process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.aivalid.id";
          const walletRes = await fetchWithAuth(`${featureBase}/api/v1/wallets/me`, { signal });
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            if (!signal.aborted) {
              setWallet({
                balance: walletData.balance || 0,
                pin_set: walletData.pinSet || walletData.pin_set || false,
              });
            }
          }

          const gRes = await fetchWithAuth(`${featureBase}/api/v1/guarantees/me`, { signal });
          if (gRes.ok) {
            const gData = await gRes.json();
            if (!signal.aborted) {
              setGuarantee({ amount: gData.amount || 0 });
            }
          }
        } catch (e) {
          if (e.name === "AbortError") return;
        }

        if (!signal.aborted) setIsLoading(false);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!signal.aborted) {
          const status = err?.status;
          const message = String(err?.message || "").toLowerCase();
          const isAuthError =
            status === 401 ||
            message.includes("not authenticated") ||
            message.includes("session_expired") ||
            message.includes("sesi telah berakhir");

          if (isAuthError) {
            clearToken();
            onClose?.();
            router.replace("/login?session=expired");
            return;
          }

          setLoadError("Terjadi gangguan jaringan sementara. Silakan coba lagi sebentar lagi.");
          setIsLoading(false);
        }
      }
    }

    loadUser();
    return () => controller.abort();
  }, [onClose, reloadTick, router]);

  // Focus trap & keyboard/click-outside handling
  useEffect(() => {
    const panelEl = panelRef.current;
    const previousActiveElement = document.activeElement;

    if (panelEl) {
      panelEl.focus();
    }

    const trapFocus = (e) => {
      const container = panelRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable.length) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === container) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const handleKey = (e) => {
      if (!e) return;
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        trapFocus(e);
      }
    };

    const handleClickOutside = (e) => {
      const target = e?.target;
      if (!target) return;

      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }

      if (panelRef.current && !panelRef.current.contains(target)) onClose?.();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("pointerdown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("pointerdown", handleClickOutside);
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, [onClose, triggerRef]);

  const handlePanelNavigation = (e) => {
    const target = e?.target;
    if (!target || typeof target.closest !== "function") return;
    const anchor = target.closest("a[href]");
    if (anchor) {
      onClose?.();
    }
  };

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    const token = getToken();
    if (token) {
      try {
        await fetch(`${getApiBase()}/api/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (_e) {
        // Ignore errors, we'll clear local tokens anyway
      }
    }
    clearToken();
    onClose?.();
    router.replace("/login");
    router.refresh();
  };

  const handleRetry = () => setReloadTick((v) => v + 1);
  const displayName = user.username || (user.email ? user.email.split("@")[0] : "Account");

  return {
    pathname,
    user,
    wallet,
    guarantee,
    isLoading,
    isSigningOut,
    loadError,
    panelRef,
    displayName,
    handlePanelNavigation,
    handleLogout,
    handleRetry,
  };
}
