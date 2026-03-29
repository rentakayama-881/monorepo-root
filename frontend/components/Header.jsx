"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import CommandPaletteTrigger from "./CommandPaletteTrigger";
import Avatar from "./ui/Avatar";
import Portal from "./ui/Portal";
import { useUserContext } from "@/lib/UserContext";
import { Menu, Plus } from "lucide-react";

const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });
const ProfileSidebar = dynamic(() => import("./ProfileSidebar"), { ssr: false });

export default function Header() {
  const pathname = usePathname();
  const { user, isLoggedIn, isLoading: profileLoading, avatarUrl } = useUserContext();
  const userName = user?.username || user?.full_name || user?.email || "";
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const sidebarPrefetchedRef = useRef(false);
  const profilePrefetchedRef = useRef(false);
  const profileTriggerRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setProfileOpen(false);
      setSidebarOpen(false);
    }
  }, [isLoggedIn]);

  const prefetchSidebar = () => {
    if (sidebarPrefetchedRef.current) return;
    sidebarPrefetchedRef.current = true;
    import("./Sidebar");
  };

  const prefetchProfileSidebar = () => {
    if (profilePrefetchedRef.current) return;
    profilePrefetchedRef.current = true;
    import("./ProfileSidebar");
  };

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e && e.key === "Escape") {
        setSidebarOpen(false);
        setProfileOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const navItem =
    "inline-flex h-8 items-center rounded-[var(--radius)] px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <header className="fixed top-0 left-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-[var(--header-height)] items-center gap-1">
        {/* Mobile menu */}
        <button
          className="flex items-center justify-center -ml-2 md:hidden p-2 rounded-[var(--radius)] hover:bg-accent transition-all duration-200 focus-ring"
          onClick={() => {
            setSidebarMounted(true);
            setSidebarOpen(true);
          }}
          onPointerEnter={prefetchSidebar}
          onFocus={prefetchSidebar}
          aria-label="Toggle menu"
          aria-expanded={sidebarOpen}
          type="button"
        >
          <Menu className="w-5 h-5 text-foreground" strokeWidth={2} />
        </button>

        {/* Logo — AV Glyph + wordmark */}
        <Link
          href="/"
          data-testid="logo"
          className="inline-flex items-center shrink-0 -ml-1 md:ml-0 rounded-lg focus:outline-none"
        >
          {/* Icon mark (always visible) */}
          <svg viewBox="0 0 512 512" className="w-7 h-7 shrink-0" aria-hidden="true">
            <path
              d="M 239.7 68.1 Q 256.0 36.0 272.3 68.1 L 463.7 443.9 Q 480.0 476.0 444.0 476.0 L 68.0 476.0 Q 32.0 476.0 48.3 443.9 Z M 246.9 238.2 Q 256.0 216.0 265.1 238.2 L 338.9 417.8 Q 348.0 440.0 324.0 440.0 L 188.0 440.0 Q 164.0 440.0 173.1 417.8 Z"
              fill="currentColor"
              fillRule="evenodd"
            />
          </svg>
          {/* Wordmark (hidden on small screens) */}
          <span className="hidden sm:inline leading-none font-bold tracking-tight text-lg ml-2">
            AIValid
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 text-sm" aria-label="Navigasi utama">
          <Link href="/" className={navItem}>
            Beranda
          </Link>
          <Link href="/market/chatgpt" prefetch={false} className={navItem}>
            Marketplace
          </Link>
          <Link href="/cloud-browser" prefetch={false} className={navItem}>
            Smart Browser
          </Link>
          <Link href="/validation-cases" prefetch={false} className={navItem}>
            Daftar Case
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Command Palette Trigger */}
        <CommandPaletteTrigger />

        {/* Right actions */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Create (single entry) */}
          <Link
            href="/validation-cases/new"
            prefetch={false}
            className={iconButton}
            aria-label="Buat case validasi"
            title="Buat case validasi"
          >
            <Plus className="h-4 w-4 text-foreground" aria-hidden="true" />
          </Link>

          {/* Theme toggle */}
          <ThemeToggle />

          {profileLoading ? (
            <div
              className="inline-flex items-center gap-2 rounded-[var(--radius)] px-2 py-1"
              aria-hidden="true"
            >
              <span className="h-6 w-6 rounded-full bg-secondary animate-pulse" />
              <span className="hidden sm:inline h-4 w-24 rounded bg-secondary animate-pulse" />
            </div>
          ) : isLoggedIn ? (
            <div className="relative">
              <button
                ref={profileTriggerRef}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-2 py-1 hover:bg-accent transition-all duration-200 hover:shadow-sm focus-ring"
                onClick={() => setProfileOpen((v) => !v)}
                onPointerEnter={prefetchProfileSidebar}
                onFocus={prefetchProfileSidebar}
                aria-label="Akun"
                aria-expanded={profileOpen}
                type="button"
              >
                {profileLoading ? (
                  <span
                    className="h-6 w-6 rounded-full bg-secondary animate-pulse"
                    aria-hidden="true"
                  />
                ) : (
                  <Avatar src={avatarUrl} name={userName} size="xs" />
                )}
                <span className="hidden sm:inline max-w-[9rem] truncate text-sm font-medium text-foreground">
                  {profileLoading ? (
                    <span
                      className="inline-block h-4 w-24 rounded bg-secondary align-middle animate-pulse"
                      aria-hidden="true"
                    />
                  ) : userName ? (
                    <>@{userName}</>
                  ) : (
                    "Akun"
                  )}
                </span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[var(--radius)] border border-border px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground hover:bg-accent transition-all duration-200"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>

      <Portal>
        {sidebarMounted ? (
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        ) : null}
        {profileOpen ? (
          <ProfileSidebar triggerRef={profileTriggerRef} onClose={() => setProfileOpen(false)} />
        ) : null}
      </Portal>
    </header>
  );
}
