"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCategories } from "../lib/categories";

const popularTopics = [
  { label: "AI & Machine Learning", href: "/category/ai-digest" },
  { label: "Karir & Riset", href: "/category/mencari-pekerjaan" },
  { label: "Startup & Inovasi", href: "/category/investor" },
  { label: "Kesehatan & Praktek Dokter", href: "/category/dokter-buka-praktek" },
  { label: "Anti Penipuan", href: "/category/anti-penipuan" },
];

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
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500";

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex h-dvh  w-80 flex-col border-r border-neutral-200 bg-white shadow-xl transition-transform duration-200 md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Sidebar"
        aria-hidden={!open}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 space-y-3 border-b border-neutral-100 bg-white px-6 pb-4 pt-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Navigasi</span>
              <span className="text-base font-semibold leading-tight text-neutral-900">Jelajahi Ballerina</span>
            </div>
            <button
              className="rounded-md p-1 text-neutral-800 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              onClick={onClose}
              aria-label="Tutup menu"
              type="button"
            >
              <svg width="22" height="22" fill="none">
                <path d="M6 6l10 10M16 6L6 16" stroke="#0f172a" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Navigasi utama */}
          <nav className="grid grid-cols-2 gap-2 text-sm font-medium text-neutral-800">
            <Link href="/" className="rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Home</Link>
            <Link href="/about-content" className="rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Tentang Kami</Link>
            <Link href="/rules-content" className="rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Aturan</Link>
            <Link href="/contact-support" className="rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Contact Support</Link>
            <Link href="/pengajuan-badge" className="rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Pengajuan Badge</Link>
            <Link href="/threads" className="rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Threads</Link>
          </nav>

          {/* AI Search */}
          <Link
            href="/ai-search"
            className="flex items-center justify-between rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={onClose}
            aria-label="AI Search"
          >
            <span className="inline-flex items-center gap-2">AI Search</span>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Search kategori */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="none">
              <path d="m15.5 15.5-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="9" r="4.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-200 bg-white px-10 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              placeholder="Cari kategori thread…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari kategori thread"
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-7 overflow-y-auto px-6 pb-8 pt-5" style={{ overscrollBehavior: "contain" }}>
          {/* Topik diskusi populer */}
          <section className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-4">
            <div className={`${sectionHeading} mb-3`}>Topik Diskusi Populer</div>
            <nav className="flex flex-col gap-1.5">
              {popularTopics.map((topic) => (
                <Link
                  key={topic.label}
                  href={topic.href}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-white hover:shadow-sm"
                  onClick={onClose}
                >
                  <span>{topic.label}</span>
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </nav>
          </section>

          {/* Kategori threads */}
          <section className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
            <div className={`${sectionHeading} mb-3`}>Kategori Threads</div>
            <nav className="flex flex-col divide-y divide-neutral-100 text-sm">
              {loadingCategories ? (
                <div className="flex items-center gap-2 px-1 py-2 text-neutral-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
                  Memuat kategori…
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="px-1 py-2 text-neutral-500">Tidak ditemukan…</div>
              ) : (
                filteredCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="flex items-center justify-between px-1 py-3 font-medium text-neutral-800 transition hover:text-neutral-900 hover:underline"
                    onClick={onClose}
                  >
                    <span>{cat.name}</span>
                    <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              )}
            </nav>
          </section>
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
