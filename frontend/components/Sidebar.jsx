"use client";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { Logo } from "./ui/Logo";

export default function Sidebar({ open, onClose }) {
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
      const lockedPathname = window.location.pathname;
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

        // If navigation happened while the sidebar was open, don't restore the
        // previous page scroll onto the next page (prevents "category starts at
        // home scroll position" confusion).
        if (window.location.pathname === lockedPathname) {
          window.scrollTo(0, scrollY);
        } else {
          window.scrollTo(0, 0);
        }
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

  const sectionHeading =
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-[120] flex flex h-dvh w-80 flex-col bg-card shadow-xl transition-all duration-300 md:hidden ${
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
          </nav>
        </div>
      </aside>

      {/* Overlay untuk mobile - match prompts.chat Sheet overlay */}
      {open && (
        <div
          className={`fixed inset-0 z-[110] bg-black/40 backdrop-blur-md supports-[backdrop-filter]:bg-black/30 md:hidden transition-opacity duration-300 ${
            isClosing ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
