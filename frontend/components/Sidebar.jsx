"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "./ui/Logo";

export default function Sidebar({ open, onClose }) {
  const handleClose = () => onClose?.();

  // Lock body scroll when sidebar is open (like prompts.chat Sheet)
  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
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

  const sectionHeading =
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-[120] flex h-full w-[280px] max-w-[82vw] flex-col border-r bg-card shadow-lg transition-transform duration-500 ease-in-out md:hidden ${
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar"
        aria-hidden={!open}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-card px-6 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <Logo
              variant="icon"
              size={40}
              onClick={handleClose}
              className="shrink-0"
            />
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
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto px-3 pb-6 pt-2 scrollbar-thin"
          style={{ overscrollBehavior: "contain" }}
        >
          <nav className="px-3 py-2 text-sm">
            <div className={`${sectionHeading} mb-2 px-2`}>Navigation</div>

            <Link
              href="/"
              className="block rounded-[var(--radius)] px-2.5 py-2 font-semibold text-foreground hover:bg-accent transition-colors"
              onClick={handleClose}
            >
              Home
            </Link>
            <Link
              href="/validation-cases"
              prefetch={false}
              className="block rounded-[var(--radius)] px-2.5 py-2 font-semibold text-foreground hover:bg-accent transition-colors"
              onClick={handleClose}
            >
              Case Index
            </Link>
            <Link
              href="/market/chatgpt"
              prefetch={false}
              className="block rounded-[var(--radius)] px-2.5 py-2 font-semibold text-foreground hover:bg-accent transition-colors"
              onClick={handleClose}
            >
              Market
            </Link>
          </nav>
        </div>
      </aside>

      {/* Overlay untuk mobile - match prompts.chat Sheet overlay */}
      {open ? (
        <div
          className="fixed inset-0 z-[110] bg-black/50 transition-opacity duration-300 md:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
