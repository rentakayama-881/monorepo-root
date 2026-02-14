"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { maskEmail } from "@/lib/email";
import Avatar from "@/components/ui/Avatar";
import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ username: "", avatar_url: "", email: "" });
  const [wallet, setWallet] = useState({ balance: 0, pin_set: false });
  const [guarantee, setGuarantee] = useState({ amount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const panelRef = useRef(null);

  // Lock body scroll when profile sidebar is open (like prompts.chat Sheet)
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const token = getToken();
      if (!token) {
        // No token = redirect to login
        onClose?.();
        window.location.href = "/login";
        return;
      }
      setIsLoading(true);
      setLoadError("");
      try {
        // Load user data with automatic token refresh
        const res = await fetchWithAuth(`${getApiBase()}/api/user/me`);
        if (res.status === 401) {
          // Session expired - clear and redirect
          clearToken();
          onClose?.();
          window.location.href = "/login?session=expired";
          return;
        }
        if (!res.ok) {
          if (!cancelled) {
            setLoadError("Profil tidak dapat dimuat saat ini. Coba lagi.");
            setIsLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setUser({
          username: data.username || data.name || "",
          avatar_url: data.avatar_url || "",
          email: data.email || "",
        });
        
        // Load wallet balance from Feature Service
        try {
          const featureBase = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";
          const walletRes = await fetchWithAuth(`${featureBase}/api/v1/wallets/me`);
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            if (!cancelled) {
              setWallet({
                balance: walletData.balance || 0,
                pin_set: walletData.pinSet || walletData.pin_set || false,
              });
            }
          }

          const gRes = await fetchWithAuth(`${featureBase}/api/v1/guarantees/me`);
          if (gRes.ok) {
            const gData = await gRes.json();
            if (!cancelled) {
              setGuarantee({
                amount: gData.amount || 0,
              });
            }
          }
        } catch (e) {
          // Silent fail for wallet - not critical
        }

        setIsLoading(false);
      } catch (err) {
        // Do not force logout on transient/network errors.
        // Logout only when auth is truly invalid.
        if (!cancelled) {
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
            window.location.href = "/login?session=expired";
            return;
          }

          setLoadError("Koneksi bermasalah. Coba lagi dalam beberapa detik.");
          setIsLoading(false);
        }
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [onClose, reloadTick]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e && e.key === "Escape") onClose?.();
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("pointerdown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [onClose]);

  const handleLogout = async () => {
    // Call logout API to invalidate server-side session
    const token = getToken();
    if (token) {
      try {
        await fetch(`${getApiBase()}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        // Ignore errors, we'll clear local tokens anyway
      }
    }
    clearToken();
    window.location.href = "/login";
  };

  const hasUser = !!user.username;

  // Show loading spinner while fetching user data
  if (isLoading || !hasUser) {
    if (!isLoading && loadError) {
      return (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            className="fixed right-3 top-14 z-[120] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-[var(--radius)] border bg-card p-4 shadow-xl"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadTick((v) => v + 1)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90"
                >
                  Coba lagi
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 z-[110] bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          className="fixed right-3 top-14 z-[120] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-[var(--radius)] border bg-card p-4 shadow-xl"
        >
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="h-10 w-10" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonText width="w-32" />
                <SkeletonText width="w-40" height="h-3" />
              </div>
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop overlay - click to close */}
      <div 
        className="fixed inset-0 z-[110] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="fixed right-3 top-14 z-[120] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-[var(--radius)] border bg-card shadow-xl flex flex-col max-h-[calc(100dvh-7rem)] animate-slide-down"
      >
        {/* Fixed header section */}
        <div className="p-4 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative">
              <Avatar 
                src={user.avatar_url} 
                name={user.username} 
                size="md" 
              />
              {/* Status indicator */}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success ring-2 ring-card" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">{user.username}</div>
              {user.email && (
                <div className="text-xs text-muted-foreground">{maskEmail(user.email)}</div>
              )}
              <div className="text-xs text-muted-foreground">Kelola aktivitas & profil Anda</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            type="button"
          >
            <span className="sr-only">Tutup menu profil</span>
            <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 pt-0 scrollbar-thin" style={{ overscrollBehavior: 'contain' }}>
        {/* Wallet Balance Card */}
        <div className="mt-4 rounded-[var(--radius)] border bg-gradient-to-br from-secondary/50 to-transparent p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Saldo</div>
                <div className="text-lg font-bold text-foreground">
                  Rp {wallet.balance.toLocaleString("id-ID")}
                </div>
                {guarantee.amount > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Jaminan Aktif:{" "}
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      Rp {guarantee.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>
              <Link
                href="/account/wallet/deposit"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-105"
              >
                + Deposit
              </Link>
            </div>
          </div>

          <nav className="mt-4 flex flex-col gap-2 text-sm text-foreground">
            {/* Wallet Section */}
            <div className="text-xs font-semibold uppercase text-muted-foreground px-1">Wallet</div>
            <Link
              href="/account/wallet/send"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Kirim Uang
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/wallet/transactions"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Transaksi Saya
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/wallet/disputes"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Dispute Center
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/wallet/withdraw"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Tarik Dana
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Account Section */}
            <div className="text-xs font-semibold uppercase text-muted-foreground px-1 mt-2">Akun</div>
            <Link
              href="/account"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/account/validation-cases"
              className="group flex items-center justify-between rounded-md border px-3 py-2 text-foreground transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                My Validation Cases
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

          </nav>
        </div>
        {/* End of scrollable content area */}

        {/* Fixed footer - Logout button - OUTSIDE scrollable area */}
        <div className="shrink-0 p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full rounded-md border border-destructive/20 px-3 py-2 text-left text-sm font-semibold text-destructive transition-all hover:bg-destructive/10 hover:border-destructive/40"
            type="button"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Keluar
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
