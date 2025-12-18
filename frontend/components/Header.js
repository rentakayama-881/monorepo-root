"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const sync = () => {
      try {
        setIsAuthed(!!getToken());
      } catch (_) {}
    };

    sync();

    const onStorage = (e) => {
      // kalau token berubah dari tab lain
      if (e.key === TOKEN_KEY) sync();
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
      const fetched = await fetchCategories();
      if (!cancelled) {
        setCategories(fetched);
        setLoadingCategories(false);
      }
    }
    loadCategories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setProfileOpen(false);
        setCategoriesOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const navLink = "text-sm font-medium text-neutral-700 hover:text-neutral-900";
  const buttonNeutral =
    "inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-white border-b border-neutral-200 shadow-sm">
      <div className="mx-auto flex h-[4.25rem] max-w-5xl items-center gap-4 px-4 sm:px-6">
        <button
          className="-ml-2 inline-flex items-center justify-center rounded-md p-2 text-neutral-800 hover:bg-neutral-100 md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Buka menu"
          type="button"
        >
          <span className="block h-0.5 w-6 rounded bg-neutral-900" />
          <span className="mt-1 block h-0.5 w-6 rounded bg-neutral-900" />
          <span className="mt-1 block h-0.5 w-6 rounded bg-neutral-900" />
        </button>

        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/images/vectorised-1758374067909.svg" alt="Logo" width={30} height={30} priority />
          <span className="hidden text-sm font-semibold tracking-tight text-neutral-800 sm:inline">Ballerina</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className={navLink}>Home</Link>
          <Link href="/threads" className={navLink}>Threads</Link>
          <div
            className="relative"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <button
              className={`${navLink} inline-flex items-center gap-1`}
              aria-haspopup="true"
              aria-expanded={categoriesOpen}
              type="button"
            >
              Kategori
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {categoriesOpen && (
              <div className="absolute left-0 top-full z-40 mt-2 w-56 max-h-80 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-md">
                {loadingCategories ? (
                  <div className="px-4 py-2 text-sm text-neutral-500">Memuat kategori…</div>
                ) : categories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-neutral-500">Kategori belum tersedia</div>
                ) : (
                  categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      className="block px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-100"
                      onClick={() => setCategoriesOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
          <Link href="/about-content" className={navLink}>Tentang Kami</Link>
          <Link href="/rules-content" className={navLink}>Aturan</Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isAuthed ? (
            <>
              <button
                className="flex items-center rounded-full border border-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Akun"
                type="button"
              >
                <Image src="/avatar-default.png" alt="Akun" width={32} height={32} className="rounded-full" />
              </button>
              {profileOpen && <ProfileSidebar onClose={() => setProfileOpen(false)} />}
            </>
          ) : (
            <Link href="/login" className={buttonNeutral}>Masuk</Link>
          )}
        </div>
      </div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  );
}
