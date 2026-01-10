"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import ProfileSidebar from "./ProfileSidebar";
import { Logo } from "./ui/Logo";
import Avatar from "./ui/Avatar";
import { fetchCategories } from "../lib/categories";
import { AUTH_CHANGED_EVENT, getToken, TOKEN_KEY } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";

export default function Header() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userName, setUserName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const categoriesWrapRef = useRef(null);

  useEffect(() => {
    const sync = () => {
      try {
        const token = getToken();
        setIsAuthed(!!token);
        if (!token) {
          setAvatarUrl(null);
          setUserName("");
        }
      } catch (_) {
        setIsAuthed(false);
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

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const token = getToken();
      if (!token) {
        setAvatarUrl(null);
        setUserName("");
        return;
      }
      try {
        // Use fetchWithAuth for auto token refresh
        const res = await fetchWithAuth(`${getApiBase()}/api/user/me`);
        if (!res || !res.ok) {
          setAvatarUrl(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAvatarUrl(data.avatar_url || null);
          setUserName(data.username || data.full_name || data.email || "");
        }
      } catch {
        if (!cancelled) setAvatarUrl(null);
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

    loadCategories();
    return () => {
      cancelled = true;
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
    "px-3 py-1.5 rounded-md text-sm font-medium text-[rgb(var(--muted))] transition-colors hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))]";

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[rgb(var(--surface-2))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[rgb(var(--surface))]/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        {/* Mobile menu */}
        <button
          className="flex items-center justify-center -ml-2 md:hidden p-2 rounded-md hover:bg-[rgb(var(--surface-2))] transition-colors"
          onClick={() => setSidebarOpen(true)}
          aria-label="Toggle menu"
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
            className="text-[rgb(var(--fg))]"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Logo - Alephdraad */}
        <Logo variant="horizontal" size={36} />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/" className={navItem}>
            Home
          </Link>

          {/* Categories dropdown */}
          <div
            ref={categoriesWrapRef}
            className="relative"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <button
              className={`${navItem} inline-flex items-center gap-1`}
              onClick={() => setCategoriesOpen(!categoriesOpen)}
              aria-haspopup="true"
              aria-expanded={categoriesOpen}
              type="button"
            >
              Kategori
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {categoriesOpen && (
              <div className="absolute left-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lg">
                <div className="max-h-80 overflow-y-auto py-1">
                  {loadingCategories ? (
                    <div className="px-3 py-2 text-sm text-[rgb(var(--muted))]">Memuat kategori…</div>
                  ) : categories.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[rgb(var(--muted))]">Kategori belum tersedia</div>
                  ) : (
                    categories.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/category/${cat.slug}`}
                        className="block px-3 py-2 text-sm text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))]"
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

          <Link href="/about-content" className={navItem}>
            Tentang Kami
          </Link>
          <Link href="/rules-content" className={navItem}>
            Aturan
          </Link>
          <Link href="/contact-support" className={navItem}>
            Contact Support
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAuthed ? (
            <div className="relative">
              <button
                className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[rgb(var(--surface-2))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Akun"
                type="button"
              >
                <Avatar 
                  src={avatarUrl} 
                  name={userName} 
                  size="sm" 
                />
                <span className="hidden sm:inline text-sm font-medium text-[rgb(var(--fg))]">Akun</span>
              </button>

              {profileOpen && <ProfileSidebar onClose={() => setProfileOpen(false)} />}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  );
}
