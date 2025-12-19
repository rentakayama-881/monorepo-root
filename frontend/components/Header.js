"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import ProfileSidebar from "./ProfileSidebar";
import { fetchCategories } from "../lib/categories";
import { AUTH_CHANGED_EVENT, getToken, TOKEN_KEY } from "@/lib/auth";

export default function Header() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const categoriesWrapRef = useRef(null);

  useEffect(() => {
    const sync = () => {
      try {
        setIsAuthed(!!getToken());
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
    "px-3 py-1.5 rounded-md text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 hover:bg-neutral-100";

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-4 sm:px-6">
        {/* Mobile menu */}
        <button
          className={`${iconButton} -ml-2 md:hidden`}
          onClick={() => setSidebarOpen(true)}
          aria-label="Toggle menu"
          type="button"
        >
          <span className="sr-only">Toggle menu</span>
          <span className="block h-0.5 w-5 rounded bg-neutral-900" />
          <span className="mt-1 block h-0.5 w-5 rounded bg-neutral-900" />
          <span className="mt-1 block h-0.5 w-5 rounded bg-neutral-900" />
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/images/vectorised-1758374067909.svg"
            alt="Logo"
            width={20}
            height={20}
            priority
            className="h-5 w-5"
          />
          <span className="font-semibold leading-none text-neutral-900">Ballerina</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/" className={navItem}>
            Home
          </Link>
          <Link href="/threads" className={navItem}>
            Threads
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
              <div className="absolute left-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
                <div className="max-h-80 overflow-y-auto py-1">
                  {loadingCategories ? (
                    <div className="px-3 py-2 text-sm text-neutral-500">Memuat kategori…</div>
                  ) : categories.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-neutral-500">Kategori belum tersedia</div>
                  ) : (
                    categories.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/category/${cat.slug}`}
                        className="block px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-100"
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
        </nav>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAuthed ? (
            <>
              <button
                className="relative inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Akun"
                type="button"
              >
                <Image src="/avatar-default.png" alt="Akun" width={24} height={24} className="rounded-full" />
                <span className="hidden sm:inline text-sm font-medium text-neutral-900">Akun</span>
              </button>

              {profileOpen && <ProfileSidebar onClose={() => setProfileOpen(false)} />}
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
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
