"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import CommandPaletteTrigger from "./CommandPaletteTrigger";
import { Logo } from "./ui/Logo";
import Avatar from "./ui/Avatar";
import Portal from "./ui/Portal";
import { fetchCategories } from "../lib/categories";
import { AUTH_CHANGED_EVENT, getToken, TOKEN_KEY } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";

const Sidebar = dynamic(() => import("./Sidebar"), { ssr: false });
const ProfileSidebar = dynamic(() => import("./ProfileSidebar"), { ssr: false });

export default function Header() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userName, setUserName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const categoriesWrapRef = useRef(null);
  const sidebarPrefetchedRef = useRef(false);
  const profilePrefetchedRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      try {
        const token = getToken();
        setIsAuthed(!!token);
        if (!token) {
          setAvatarUrl(null);
          setUserName("");
          setProfileLoading(false);
        }
      } catch (_) {
        setIsAuthed(false);
      } finally {
        setAuthChecked(true);
      }
    };

    sync();

    const onStorage = (e) => {
      if (e && e.key === TOKEN_KEY) sync();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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
    let cancelled = false;

    async function loadProfile() {
      const token = getToken();
      if (!token) {
        setAvatarUrl(null);
        setUserName("");
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        // Use fetchWithAuth for auto token refresh
        const res = await fetchWithAuth(`${getApiBase()}/api/user/me`);
        if (!res || !res.ok) {
          setAvatarUrl(null);
          setUserName("");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAvatarUrl(data.avatar_url || null);
          setUserName(data.username || data.full_name || data.email || "");
        }
      } catch {
        if (!cancelled) setAvatarUrl(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      try {
        const fetched = await fetchCategories();
        if (!cancelled) setCategories(Array.isArray(fetched) ? fetched : []);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }

    const start = () => {
      if (cancelled) return;
      loadCategories();
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(start, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e && e.key === "Escape") {
        setSidebarOpen(false);
        setProfileOpen(false);
        setCategoriesOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (categoriesWrapRef.current && !categoriesWrapRef.current.contains(e.target)) {
        setCategoriesOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navItem =
    "px-3 py-1.5 rounded-[var(--radius)] text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-accent";

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius)] hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-shadow duration-200">
      <div className="container flex h-12 items-center">
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
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-foreground"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Logo - AIvalid */}
        <Logo
          variant="horizontal"
          size={44}
          priority
          className="shrink-0 -ml-1 md:ml-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_6px_20px_rgba(0,0,0,0.22)]"
        />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 text-sm">
          <Link href="/" className={navItem}>
            Home
          </Link>

          {/* Categories dropdown */}
          <div
            ref={categoriesWrapRef}
            className="relative"
          >
            <button
              className={`${navItem} inline-flex items-center gap-0.5 ${categoriesOpen ? "bg-accent text-foreground" : ""}`}
              onClick={() => setCategoriesOpen(!categoriesOpen)}
              aria-haspopup="true"
              aria-expanded={categoriesOpen}
              aria-controls="categories-menu"
              type="button"
            >
              Kategori
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {categoriesOpen && (
              <div
                id="categories-menu"
                className="absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border bg-popover shadow-lg animate-scale-in"
                role="menu"
                aria-label="Kategori"
              >
                <div className="max-h-80 overflow-y-auto py-1">
                  {loadingCategories ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                  ) : categories.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No categories available</div>
                  ) : (
                    categories.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/category/${cat.slug}`}
                        className="block px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors duration-150"
                        onClick={() => setCategoriesOpen(false)}
                      >
                        {cat.name}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-1" />

        {/* Command Palette Trigger */}
        <CommandPaletteTrigger />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <ThemeToggle />

          {!authChecked ? (
            <div
              className="inline-flex items-center gap-2 rounded-[var(--radius)] px-2 py-1"
              aria-hidden="true"
            >
              <span className="h-6 w-6 rounded-full bg-secondary animate-pulse" />
              <span className="hidden sm:inline h-4 w-24 rounded bg-secondary animate-pulse" />
            </div>
          ) : isAuthed ? (
            <div className="relative">
              <button
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
            <>
              <Link
                href="/login"
                className="px-2 py-1 rounded-[var(--radius)] text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-[var(--radius)] bg-primary px-2 py-1 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-200 hover:shadow-md active:scale-95"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>

      <Portal>
        {sidebarMounted ? (
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        ) : null}
        {profileOpen ? <ProfileSidebar onClose={() => setProfileOpen(false)} /> : null}
      </Portal>
    </header>
  );
}
