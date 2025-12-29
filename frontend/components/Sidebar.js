"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCategories } from "../lib/categories";

export default function Sidebar({ open, onClose }) {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

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

  const filteredCategories = search.trim()
    ? categories.filter(cat => cat.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const sectionHeading =
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-[rgb(var(--muted))]";

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex h-dvh w-80 flex-col border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-xl transition-transform duration-200 md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Sidebar"
        aria-hidden={!open}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 space-y-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={onClose} className="flex items-center gap-2">
              <img src="/logo/logo-icon-only.svg" alt="Alephdraad" className="h-8 w-8 dark:hidden" />
              <img src="/logo/logo-icon-only-dark.svg" alt="Alephdraad" className="hidden h-8 w-8 dark:block" />
            </Link>
            <button
              className="rounded-md p-1 text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]"
              onClick={onClose}
              aria-label="Tutup menu"
              type="button"
            >
              <svg width="22" height="22" fill="none">
                <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Quick nav */}
          <nav className="flex gap-2 text-sm font-medium text-[rgb(var(--fg))]">
            <Link href="/" className="flex-1 rounded-md border border-[rgb(var(--border))] px-3 py-2 text-center hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]" onClick={onClose}>Home</Link>
            <Link href="/threads" className="flex-1 rounded-md border border-[rgb(var(--border))] px-3 py-2 text-center hover:border-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]" onClick={onClose}>Threads</Link>
          </nav>

          {/* AI Search */}
          <Link
            href="/ai-search"
            className="flex items-center justify-between rounded-lg border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            onClick={onClose}
            aria-label="AI Search"
          >
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              AI Search
            </span>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Search kategori */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 20 20" fill="none">
              <path d="m15.5 15.5-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="9" r="4.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              type="text"
              className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-10 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]"
              placeholder="Cari kategori thread…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari kategori thread"
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-5" style={{ overscrollBehavior: "contain" }}>
          {/* Kategori threads */}
          <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <div className={`${sectionHeading} mb-3`}>Kategori Threads</div>
            <nav className="flex flex-col divide-y divide-[rgb(var(--border))] text-sm">
              {loadingCategories ? (
                <div className="flex items-center gap-2 px-1 py-2 text-[rgb(var(--muted))]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[rgb(var(--muted))]" />
                  Memuat kategori…
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="px-1 py-2 text-[rgb(var(--muted))]">Tidak ditemukan…</div>
              ) : (
                filteredCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="flex items-center justify-between px-1 py-3 font-medium text-[rgb(var(--fg))] transition hover:text-[rgb(var(--brand))] hover:underline"
                    onClick={onClose}
                  >
                    <span>{cat.name}</span>
                    <svg className="h-4 w-4 text-[rgb(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              )}
            </nav>
          </section>
        </div>

        {/* Professional Footer */}
        <div className="shrink-0 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-6 py-4">
          {/* Footer Links */}
          <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <Link href="/about-content" onClick={onClose} className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:underline">
              Tentang
            </Link>
            <span className="text-[rgb(var(--border))]">•</span>
            <Link href="/rules-content" onClick={onClose} className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:underline">
              Aturan
            </Link>
            <span className="text-[rgb(var(--border))]">•</span>
            <Link href="/contact-support" onClick={onClose} className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:underline">
              Bantuan
            </Link>
          </nav>
          
          {/* Copyright */}
          <p className="text-center text-[10px] text-[rgb(var(--muted))]">
            © {new Date().getFullYear()} Alephdraad. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Overlay untuk mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onClose}
          aria-label="Sidebar Overlay"
        />
      )}
    </>
  );
}
