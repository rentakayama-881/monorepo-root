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

  return (
    <header className="fixed top-0 left-0 w-full z-modal bg-white/95 border-b border-slate-200 shadow-sm backdrop-blur">
      <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 h-[4.25rem] relative">
        {/* Hamburger */}
        <button
          className="md:hidden p-2 -ml-2 rounded-md hover:bg-slate-100"
          onClick={() => setSidebarOpen(true)}
          aria-label="Buka menu"
        >
          <span className="block w-6 h-0.5 bg-slate-900 mb-1 rounded transition-all"></span>
          <span className="block w-6 h-0.5 bg-slate-900 mb-1 rounded transition-all"></span>
          <span className="block w-6 h-0.5 bg-slate-900 rounded transition-all"></span>
        </button>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/images/vectorised-1758374067909.svg" alt="Logo" width={34} height={34} priority />
          <span className="hidden sm:inline text-sm font-semibold tracking-tight text-slate-800">Ballerina</span>
        </Link>
        {/* Navigasi Desktop */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          <Link href="/" className="hover:text-slate-900">Home</Link>
          <Link href="/threads" className="hover:text-slate-900">Threads</Link>
          <div
            className="relative"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <button className="hover:text-slate-900 flex items-center gap-1" aria-haspopup="true" aria-expanded={categoriesOpen}>
              Kategori
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Dropdown kategori */}
            {categoriesOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg z-dropdown">
                {loadingCategories ? (
                  <div className="px-4 py-2 text-sm text-slate-500">Memuat kategori…</div>
                ) : categories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-slate-500">Kategori belum tersedia</div>
                ) : (
                  categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                      onClick={() => setCategoriesOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
          <Link href="/about-content" className="hover:text-slate-900">Tentang Kami</Link>
          <Link href="/rules-content" className="hover:text-slate-900">Aturan</Link>
        </nav>
        {/* Profile/Login */}
        <div className="flex items-center gap-3 ml-auto">
          {isAuthed ? (
            <>
              <button
                className="focus:outline-none rounded-full ring-offset-2 ring-offset-white"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Akun"
              >
                <Image src="/avatar-default.png" alt="Akun" width={32} height={32} className="rounded-full border border-slate-200" />
              </button>
              {profileOpen && <ProfileSidebar onClose={() => setProfileOpen(false)} />}
            </>
          ) : (
            <Link href="/login" className="btn btn-secondary text-sm">Masuk</Link>
          )}
        </div>
      </div>
      {/* Sidebar mobile */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  );
}
