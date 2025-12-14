"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ProfileSidebar from "./ProfileSidebar";
import { fetchCategories } from "../lib/categories";

export default function Header() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    try { setIsAuthed(!!localStorage.getItem("token")); } catch (_) {}
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

  return (
    <header className="fixed top-0 left-0 w-full z-modal bg-white border-b border-neutral-200 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16 relative">
        {/* Hamburger */}
        <button
          className="md:hidden p-2 mr-2"
          onClick={() => setSidebarOpen(true)}
          aria-label="Buka menu"
        >
          <span className="block w-6 h-0.5 bg-black mb-1 rounded transition-all"></span>
          <span className="block w-6 h-0.5 bg-black mb-1 rounded transition-all"></span>
          <span className="block w-6 h-0.5 bg-black rounded transition-all"></span>
        </button>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/images/vectorised-1758374067909.svg" alt="Logo" width={36} height={36} priority/>
        </Link>
        {/* Navigasi Desktop */}
        <nav className="hidden md:flex gap-8 text-base font-medium text-neutral-700 mx-auto">
          <Link href="/" className="hover:text-black">Home</Link>
          <Link href="/threads" className="hover:text-black">Threads</Link>
          <div className="relative"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <button className="hover:text-black flex items-center gap-1" aria-haspopup="true" aria-expanded={categoriesOpen}>
              Kategori
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {/* Dropdown kategori */}
            {categoriesOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 max-h-96 overflow-y-auto bg-white border border-neutral-200 rounded shadow-lg z-dropdown animate-fadeIn">
                {loadingCategories ? (
                  <div className="px-4 py-2 text-sm text-neutral-500">Memuat kategori…</div>
                ) : categories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-neutral-500">Kategori belum tersedia</div>
                ) : (
                  categories.map(cat => (
                    <Link key={cat.slug} href={`/category/${cat.slug}`}
                      className="block px-4 py-2 text-sm text-neutral-700 hover:bg-blue-50 hover:text-blue-700 transition"
                      onClick={() => setCategoriesOpen(false)}
                    >{cat.name}</Link>
                  ))
                )}
              </div>
            )}
          </div>
          <Link href="/about-content" className="hover:text-black">Tentang Kami</Link>
          <Link href="/rules-content" className="hover:text-black">Aturan</Link>
        </nav>
        {/* Profile/Login */}
        <div className="flex items-center gap-2">
          {isAuthed ? (
            <>
              <button className="focus:outline-none" onClick={() => setProfileOpen(!profileOpen)} aria-label="Akun">
                <Image src="/avatar-default.png" alt="Akun" width={32} height={32} className="rounded-full"/>
              </button>
              {profileOpen && <ProfileSidebar onClose={() => setProfileOpen(false)} />}
            </>
          ) : (
            <Link href="/login" className="btn">Masuk</Link>
          )}
        </div>
      </div>
      {/* Sidebar mobile */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  );
}
