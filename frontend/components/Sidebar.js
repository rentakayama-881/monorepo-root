"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { fetchCategories } from "../lib/categories";
import { LOCKED_CATEGORIES } from "../lib/constants";

// Simplified - only 2 models
const AI_MODELS = [
  { id: "claude-sonnet-4.5", name: "Claude 4.5", provider: "Anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
];

export default function Sidebar({ open, onClose }) {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const sidebarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200); // Match animation duration
  }, [onClose]);

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

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Swipe to close gesture for mobile
  useEffect(() => {
    if (!open || !sidebarRef.current) return;

    const sidebar = sidebarRef.current;
    
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
    };
    
    const handleTouchMove = (e) => {
      touchEndX.current = e.touches[0].clientX;
    };
    
    const handleTouchEnd = () => {
      const swipeDistance = touchStartX.current - touchEndX.current;
      // If swiped left more than 50px, close sidebar
      if (swipeDistance > 50) {
        handleClose();
      }
    };
    
    sidebar.addEventListener('touchstart', handleTouchStart);
    sidebar.addEventListener('touchmove', handleTouchMove);
    sidebar.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      sidebar.removeEventListener('touchstart', handleTouchStart);
      sidebar.removeEventListener('touchmove', handleTouchMove);
      sidebar.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open, handleClose]);

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
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 flex flex h-dvh w-80 flex-col border-r bg-card shadow-xl transition-all duration-300 md:hidden ${
          open && !isClosing 
            ? "translate-x-0 opacity-100" 
            : "-translate-x-full opacity-0"
        }`}
        style={{
          transitionTimingFunction: open && !isClosing 
            ? 'cubic-bezier(0.16, 1, 0.3, 1)' 
            : 'cubic-bezier(0.7, 0, 0.84, 0)'
        }}
        aria-label="Sidebar"
        aria-hidden={!open}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 space-y-3 border-b bg-card px-6 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={handleClose} className="flex items-center gap-2">
              <Image src="/logo/logo-icon-only.svg" alt="Alephdraad" width={32} height={32} className="dark:hidden" />
              <Image src="/logo/logo-icon-only-dark.svg" alt="Alephdraad" width={32} height={32} className="hidden dark:block" />
            </Link>
            <button
              className="rounded-[var(--radius)] p-1 text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={handleClose}
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
            <Link href="/" className="flex-1 rounded-[var(--radius)] border px-3 py-2 text-center hover:border-muted-foreground hover:bg-accent transition-all" onClick={handleClose}>Home</Link>
            <Link href="/threads" className="flex-1 rounded-[var(--radius)] border px-3 py-2 text-center hover:border-muted-foreground hover:bg-accent transition-all" onClick={handleClose}>Threads</Link>
          </nav>

          {/* AI Search */}
          <Link
            href="/ai-search"
            className="flex items-center justify-between rounded-[var(--radius)] border border-primary bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            onClick={handleClose}
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

          {/* AI Studio - 2 Model Cards */}
          <div className="rounded-[var(--radius)] border bg-gradient-to-br from-card to-secondary p-3 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">AI Studio</div>
                <div className="text-[10px] text-muted-foreground">Pilih model untuk chat</div>
              </div>
            </div>
            
            {/* 2 Model Cards */}
            <div className="grid grid-cols-2 gap-2">
              {AI_MODELS.map((model) => (
                <Link
                  key={model.id}
                  href={`/ai-studio/chat?model=${model.id}`}
                  onClick={handleClose}
                  className="flex flex-col items-center gap-1 rounded-[var(--radius)] border bg-card p-3 text-center transition-all hover:border-primary hover:shadow-sm active:scale-95"
                >
                  <span className="text-xs font-semibold text-foreground">{model.name}</span>
                  <span className="text-[10px] text-muted-foreground">{model.provider}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Search kategori */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="none">
              <path d="m15.5 15.5-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="9" r="4.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              type="text"
              className="w-full rounded-[var(--radius)] border bg-card px-10 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              placeholder="Cari kategori thread…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari kategori thread"
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-5 scrollbar-thin" style={{ overscrollBehavior: "contain" }}>
          {/* Kategori threads */}
          <section className="rounded-[var(--radius)] border bg-card p-4">
            <div className={`${sectionHeading} mb-3`}>Kategori Threads</div>
            <nav className="flex flex-col divide-y divide-border text-sm stagger-children">
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
                      className="flex items-center justify-between px-1 py-3 font-medium text-foreground transition-all hover:text-primary hover:translate-x-1"
                      onClick={handleClose}
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
                      <svg className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-strong md:hidden transition-opacity duration-300 ${
            isClosing ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
