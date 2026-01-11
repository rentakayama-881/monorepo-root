"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api";
import { clearToken, getToken, getRefreshToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { maskEmail } from "@/lib/email";
import { useTokenBalance } from "@/lib/useAIChat";
import { useDocumentStats, formatFileSize } from "@/lib/useDocuments";
import Avatar from "@/components/ui/Avatar";

export default function ProfileSidebar({ onClose }) {
  const [user, setUser] = useState({ username: "", avatar_url: "", email: "" });
  const [wallet, setWallet] = useState({ balance: 0, pin_set: false });
  const [isLoading, setIsLoading] = useState(true);
  const panelRef = useRef(null);

  // Lock body scroll when profile sidebar is open (like prompts.chat Sheet)
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // AI Token balance
  const { balance: tokenBalance, loading: tokenLoading } = useTokenBalance({ skip: false });
  
  // Document stats
  const { stats: docStats, loading: docStatsLoading } = useDocumentStats({ skip: false });

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
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (cancelled) return;
        setUser({
          username: data.username || data.name || "",
          avatar_url: data.avatar_url || "",
        });
        
        // Load wallet balance with automatic token refresh
        try {
          const walletRes = await fetchWithAuth(`${getApiBase()}/api/wallet/balance`);
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            if (!cancelled) {
              setWallet({
                balance: walletData.balance || 0,
                pin_set: walletData.pin_set || false,
              });
            }
          }
        } catch (e) {
          // Silent fail for wallet - not critical
        }
        
        setIsLoading(false);
      } catch (err) {
        // Network error - redirect to login
        if (!cancelled) {
          clearToken();
          onClose?.();
          window.location.href = "/login";
        }
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e && e.key === "Escape") onClose?.();
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleLogout = async () => {
    // Call logout API to invalidate server-side session
    const token = getToken();
    const refreshToken = getRefreshToken();
    if (token && refreshToken) {
      try {
        await fetch(`${getApiBase()}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
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
    return (
      <>
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          className="fixed right-4 top-16 z-50 w-80 rounded-[var(--radius)] border bg-card p-4 shadow-xl"
        >
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop overlay - click to close */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-strong animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="fixed right-4 top-16 z-50 w-80 rounded-[var(--radius)] border bg-card shadow-xl flex flex-col max-h-[calc(100dvh-6rem)] animate-slide-down"
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
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500 ring-2 ring-card" />
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
        {/* User Stats Section */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-[var(--radius)] border bg-secondary/50 p-3">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">0</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Threads</div>
          </div>
          <div className="text-center border-x">
            <div className="text-lg font-bold text-foreground">0</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Replies</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">0</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Points</div>
          </div>
        </div>

        {/* Wallet Balance Card */}
        <div className="mt-4 rounded-[var(--radius)] border bg-gradient-to-br from-secondary/50 to-transparent p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Saldo</div>
                <div className="text-lg font-bold text-foreground">
                  Rp {wallet.balance.toLocaleString("id-ID")}
                </div>
              </div>
              <Link
                href="/account/wallet/deposit"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
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
              href="/threads"
              className="group flex items-center justify-between rounded-md border px-3 py-2 text-foreground transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                My Threads
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* AI Hub Section */}
            <div className="text-xs font-semibold uppercase text-muted-foreground px-1 mt-3 flex items-center gap-1.5">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              AI Hub
            </div>
            
            {/* AI Token Balance Mini Card */}
            <div className="rounded-md border border-primary/30 bg-gradient-to-r from-primary/5 to-transparent px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">AI Credits</div>
                    <div className="text-sm font-bold text-foreground">
                      {tokenLoading ? "..." : tokenBalance.tokens.toLocaleString()}
                    </div>
                  </div>
                </div>
                <Link
                  href="/ai-chat/tokens"
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Top Up
                </Link>
              </div>
            </div>

            <Link
              href="/ai-chat"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 text-primary transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                <span className="font-medium">Aleph Assistant</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">FREE</span>
            </Link>

            {/* DocVault Section */}
            <div className="text-xs font-semibold uppercase text-muted-foreground px-1 mt-3 flex items-center gap-1.5">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
              </svg>
              DocVault
            </div>
            
            {/* Storage Usage Mini Card */}
            <div className="rounded-md border bg-secondary px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Storage</span>
                <span className="text-[10px] text-muted-foreground">
                  {docStatsLoading ? "..." : `${formatFileSize(docStats.totalSize)} / ${formatFileSize(docStats.maxSize)}`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${docStatsLoading ? 0 : docStats.usedPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">
                  {docStatsLoading ? "..." : `${docStats.totalDocuments} files`}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {docStatsLoading ? "..." : `${docStats.usedPercentage}%`}
                </span>
              </div>
            </div>

            <Link
              href="/documents"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                My Documents
              </span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/documents/upload"
              className="group flex items-center justify-between rounded-md border border-dashed px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Upload Document
              </span>
            </Link>

            {/* Activity Section */}
            <div className="text-xs font-semibold uppercase text-muted-foreground px-1 mt-3 flex items-center gap-1.5">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Activity
            </div>
            <Link
              href="/reports"
              className="group flex items-center justify-between rounded-md border px-3 py-2 transition-all hover:border-primary hover:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                My Reports
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
