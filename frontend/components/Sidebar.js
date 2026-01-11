"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchCategories } from "../lib/categories";
import { LOCKED_CATEGORIES } from "../lib/constants";
import { EXTERNAL_LLM_MODELS } from "@/lib/useAIChat";

export default function Sidebar({ open, onClose }) {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);

  // Lock body scroll when sidebar is open (like prompts.chat Sheet)
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

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
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex h-dvh w-80 flex-col border-r bg-card shadow-xl transition-transform duration-200 md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Sidebar"
        aria-hidden={!open}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 space-y-3 border-b bg-card px-6 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={onClose} className="flex items-center gap-2">
              <Image src="/logo/logo-icon-only.svg" alt="Alephdraad" width={32} height={32} className="dark:hidden" />
              <Image src="/logo/logo-icon-only-dark.svg" alt="Alephdraad" width={32} height={32} className="hidden dark:block" />
            </Link>
            <button
              className="rounded-[var(--radius)] p-1 text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
          <nav className="flex gap-2 text-sm font-medium text-foreground">
            <Link href="/" className="flex-1 rounded-[var(--radius)] border px-3 py-2 text-center hover:border-muted-foreground hover:bg-accent" onClick={onClose}>Home</Link>
            <Link href="/threads" className="flex-1 rounded-[var(--radius)] border px-3 py-2 text-center hover:border-muted-foreground hover:bg-accent" onClick={onClose}>Threads</Link>
          </nav>

          {/* AI Search */}
          <Link
            href="/ai-search"
            className="flex items-center justify-between rounded-[var(--radius)] border border-primary bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
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

          {/* AI Studio - Multi-model Chat */}
          <div className="rounded-[var(--radius)] border bg-gradient-to-br from-card to-secondary p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">AI Studio</div>
                <div className="text-[10px] text-muted-foreground">Premium multi-model chat</div>
              </div>
            </div>
            
            {/* Model Picker Toggle */}
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-between rounded-[var(--radius)] border bg-card px-3 py-2 text-xs transition hover:border-muted-foreground"
            >
              <span className="flex items-center gap-2">
                {selectedModel ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-foreground font-medium">{selectedModel.name}</span>
                    <span className="text-muted-foreground">• {selectedModel.provider}</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <span className="text-muted-foreground">Pilih Model AI...</span>
                  </>
                )}
              </span>
              <svg className={`h-4 w-4 text-muted-foreground transition-transform ${showModelPicker ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Dropdown */}
            {showModelPicker && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--radius)] border bg-card divide-y divide-border">
                {EXTERNAL_LLM_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model);
                      setShowModelPicker(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition hover:bg-accent ${
                      selectedModel?.id === model.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{model.name}</span>
                      <span className="text-muted-foreground">{model.provider}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">{model.description}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Start Chat Button */}
            <Link
              href={selectedModel ? `/ai-studio?model=${selectedModel.id}` : '/ai-studio'}
              onClick={onClose}
              className={`mt-2 w-full flex items-center justify-center gap-2 rounded-[var(--radius)] px-3 py-2 text-xs font-medium transition ${
                selectedModel 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90' 
                  : 'bg-secondary text-muted-foreground hover:bg-border'
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {selectedModel ? 'Mulai Chat' : 'Pilih Model Dulu'}
            </Link>
          </div>

          {/* Search kategori */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="none">
              <path d="m15.5 15.5-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="9" r="4.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              type="text"
              className="w-full rounded-[var(--radius)] border bg-card px-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
          <section className="rounded-[var(--radius)] border bg-card p-4">
            <div className={`${sectionHeading} mb-3`}>Kategori Threads</div>
            <nav className="flex flex-col divide-y divide-border text-sm">
              {loadingCategories ? (
                <div className="flex items-center gap-2 px-1 py-2 text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                  Memuat kategori…
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="px-1 py-2 text-muted-foreground">Tidak ditemukan…</div>
              ) : (
                filteredCategories.map((cat) => {
                  const isLocked = LOCKED_CATEGORIES.includes(cat.slug);
                  return (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      className="flex items-center justify-between px-1 py-3 font-medium text-foreground transition hover:text-primary hover:underline"
                      onClick={onClose}
                    >
                      <span className="flex items-center gap-2">
                        {cat.name}
                        {isLocked && (
                          <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </span>
                      <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  );
                })
              )}
            </nav>
          </section>
        </div>
      </aside>

      {/* Overlay untuk mobile - match prompts.chat Sheet overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
