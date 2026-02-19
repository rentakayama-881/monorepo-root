"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { maskEmail } from "@/lib/email";
import Avatar from "@/components/ui/Avatar";
import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";

const walletLinks = [
  {
    href: "/account/wallet/send",
    label: "Send Funds",
    iconPath: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  },
  {
    href: "/account/wallet/transactions",
    label: "Transactions",
    iconPath:
      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    href: "/account/wallet/disputes",
    label: "Dispute Center",
    iconPath:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  {
    href: "/account/wallet/withdraw",
    label: "Withdraw",
    iconPath:
      "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  },
];

const accountLinks = [
  {
    href: "/account",
    label: "Account",
    iconPath: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    href: "/account/my-purchases",
    label: "My Purchase",
    iconPath: "M3 7h18M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2m-1 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7m3 4h4m-4 4h4",
  },
  {
    href: "/account/validation-cases",
    label: "My Validation Cases",
    iconPath:
      "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  },
];

function MenuItemLink({ href, label, iconPath, isActive }) {
  const itemClassName = isActive
    ? "group flex items-center justify-between rounded-lg border border-foreground/20 bg-accent px-3 py-2 transition-colors"
    : "group flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2 transition-colors hover:border-border hover:bg-accent/60";

  const iconClassName = isActive
    ? "h-4 w-4 text-foreground"
    : "h-4 w-4 text-muted-foreground";

  const labelClassName = isActive
    ? "flex items-center gap-2.5 text-sm font-semibold text-foreground"
    : "flex items-center gap-2.5 text-sm font-medium text-foreground";

  return (
    <Link
      href={href}
      className={itemClassName}
      aria-current={isActive ? "page" : undefined}
    >
      <span className={labelClassName}>
        <svg className={iconClassName} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
        {label}
      </span>
      <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function ProfileSidebar({ onClose, triggerRef }) {
  const pathname = usePathname();
  const [user, setUser] = useState({ username: "", avatar_url: "", email: "" });
  const [wallet, setWallet] = useState({ balance: 0, pin_set: false });
  const [guarantee, setGuarantee] = useState({ amount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const panelRef = useRef(null);

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
    const controller = new AbortController();
    const { signal } = controller;

    async function loadUser() {
      const token = getToken();
      if (!token) {
        onClose?.();
        window.location.href = "/login";
        return;
      }
      setIsLoading(true);
      setLoadError("");
      try {
        const res = await fetchWithAuth(`${getApiBase()}/api/user/me`, { signal });
        if (res.status === 401) {
          clearToken();
          onClose?.();
          window.location.href = "/login?session=expired";
          return;
        }
        if (!res.ok) {
          if (!signal.aborted) {
            setLoadError("Your profile could not be loaded at this time. Please try again.");
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
          const featureBase = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";
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
        // Only force logout on genuine auth errors, not transient/network issues
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
            window.location.href = "/login?session=expired";
            return;
          }

          setLoadError("A temporary network issue occurred. Please try again in a moment.");
          setIsLoading(false);
        }
      }
    }

    loadUser();
    return () => controller.abort();
  }, [onClose, reloadTick]);

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

  const displayName = user.username || (user.email ? user.email.split("@")[0] : "Account");
  const overlayClassName = "fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300";
  const panelBaseClassName =
    "fixed right-2 top-[3.35rem] z-[110] w-[16.5rem] max-w-[calc(100vw-0.75rem)] rounded-2xl border border-border/75 bg-card/95 shadow-[0_14px_28px_rgba(0,0,0,0.18)] backdrop-blur-md flex flex-col max-h-[calc(100dvh-4.1rem)] animate-slide-in-from-right";
  const panelPaddedClassName = `${panelBaseClassName} p-3`;
  const isLinkActive = (href) => {
    if (!pathname) return false;
    if (href === "/account") return pathname === "/account";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Show load error state
  if (loadError && !isLoading) {
    return (
      <>
        <div
          className={overlayClassName}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          className={panelPaddedClassName}
          role="dialog"
          aria-modal="true"
          aria-label="Account panel"
          tabIndex={-1}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReloadTick((v) => v + 1)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show loading spinner while fetching user data
  if (isLoading) {
    return (
      <>
        {/* Backdrop overlay */}
        <div 
          className={overlayClassName}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          className={panelPaddedClassName}
          role="dialog"
          aria-modal="true"
          aria-label="Account panel"
          tabIndex={-1}
        >
          <div className="space-y-3.5" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2.5">
              <SkeletonCircle size="h-8 w-8" className="bg-muted-foreground/20 dark:bg-secondary" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonText width="w-28" className="bg-muted-foreground/20 dark:bg-secondary" />
                <SkeletonText width="w-36" height="h-3" className="bg-muted-foreground/20 dark:bg-secondary" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md bg-muted-foreground/20 dark:bg-secondary" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-md bg-muted-foreground/20 dark:bg-secondary" />
              <Skeleton className="h-9 w-full rounded-md bg-muted-foreground/20 dark:bg-secondary" />
              <Skeleton className="h-9 w-full rounded-md bg-muted-foreground/20 dark:bg-secondary" />
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
        className={overlayClassName}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={panelBaseClassName}
        role="dialog"
        aria-modal="true"
          aria-label="Account panel"
        tabIndex={-1}
        onClickCapture={handlePanelNavigation}
      >
        {/* Fixed header section */}
        <div className="shrink-0 p-3 pb-0">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative">
              <Avatar 
                src={user.avatar_url} 
                name={displayName} 
                size="sm"
              />
              {/* Status indicator */}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success ring-2 ring-card" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
              {user.email && (
                <div className="text-[11px] text-muted-foreground">{maskEmail(user.email)}</div>
              )}
              <div className="text-[11px] text-muted-foreground">Manage your activity and profile settings</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            type="button"
          >
            <span className="sr-only">Close profile menu</span>
            <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-3 pt-0 scrollbar-thin" style={{ overscrollBehavior: "contain" }}>
        {/* Wallet Balance Card */}
        <div className="mt-3 rounded-lg border border-border/70 bg-gradient-to-b from-secondary/40 to-card p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Balance</div>
                <div className="text-base font-semibold tracking-tight text-foreground">
                  Rp {wallet.balance.toLocaleString("id-ID")}
                </div>
                {guarantee.amount > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Active Guarantee:{" "}
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      Rp {guarantee.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>
              <Link
                href="/account/wallet/deposit"
                className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                + Deposit
              </Link>
            </div>
          </div>

          <nav className="mt-3 flex flex-col gap-1.5 text-sm text-foreground">
            {/* Wallet Section */}
            <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Wallet</div>
            {walletLinks.map((item) => (
              <MenuItemLink
                key={item.href}
                href={item.href}
                label={item.label}
                iconPath={item.iconPath}
                isActive={isLinkActive(item.href)}
              />
            ))}

            {/* Account Section */}
            <div className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Account</div>
            {accountLinks.map((item) => (
              <MenuItemLink
                key={item.href}
                href={item.href}
                label={item.label}
                iconPath={item.iconPath}
                isActive={isLinkActive(item.href)}
              />
            ))}

          </nav>
        </div>
        {/* End of scrollable content area */}

        {/* Fixed footer - Logout button - OUTSIDE scrollable area */}
        <div className="shrink-0 border-t p-3">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-destructive/25 bg-destructive/[0.03] px-3 py-2 text-left text-sm font-semibold text-destructive transition-colors hover:border-destructive/40 hover:bg-destructive/10"
            type="button"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
