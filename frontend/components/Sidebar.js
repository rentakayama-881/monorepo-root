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

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 max-h-screen bg-white border-r border-neutral-200 shadow-xl transition-transform duration-200 md:hidden flex flex-col ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Sidebar"
        aria-hidden={!open}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-neutral-100 bg-white px-6 pt-4 pb-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold tracking-tight text-neutral-900">Menu</span>
            <button
              className="rounded-md p-1 text-neutral-800 hover:bg-neutral-100"
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
          <nav className="flex flex-wrap gap-2 text-sm font-medium text-neutral-800">
            <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-neutral-100" onClick={onClose}>Home</Link>
            <Link href="/about-content" className="rounded-md px-3 py-1.5 hover:bg-neutral-100" onClick={onClose}>Tentang Kami</Link>
            <Link href="/rules-content" className="rounded-md px-3 py-1.5 hover:bg-neutral-100" onClick={onClose}>Aturan</Link>
            <Link href="/contact-support" className="rounded-md px-3 py-1.5 hover:bg-neutral-100" onClick={onClose}>Contact Support</Link>
            <Link href="/pengajuan-badge" className="rounded-md px-3 py-1.5 hover:bg-neutral-100" onClick={onClose}>Pengajuan Badge</Link>
          </nav>
          {/* AI Search */}
          <div className="pt-2">
            <Link
              href="/ai-search"
              className="block w-full rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
              onClick={onClose}
              aria-label="AI Search"
            >
              <span className="inline-flex items-center gap-2">AI Search</span>
            </Link>
          </div>
          {/* Search kategori */}
          <input
            type="text"
            className="mt-3 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-800"
            placeholder="Cari kategori thread…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Cari kategori thread"
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-8 pt-4" style={{ overscrollBehavior: "contain" }}>
          {/* Topik diskusi populer */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Topik Diskusi Populer</div>
            <nav className="flex flex-col gap-2">
              {popularTopics.map(topic => (
                <Link
                  key={topic.label}
                  href={topic.href}
                  className="block rounded-md px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
                  onClick={onClose}
                >
                  {topic.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Kategori threads */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Kategori Threads</div>
            <nav className="flex flex-col gap-1.5 text-sm">
              {loadingCategories ? (
                <div className="px-4 py-2 text-neutral-500">Memuat kategori…</div>
              ) : filteredCategories.length === 0 ? (
                <div className="px-4 py-2 text-neutral-500">Tidak ditemukan…</div>
              ) : (
                filteredCategories.map(cat => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="block rounded-md px-4 py-2 font-medium text-neutral-800 hover:bg-neutral-100"
                    onClick={onClose}
                  >
                    {cat.name}
                  </Link>
                ))
              )}
            </nav>
          </div>
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
