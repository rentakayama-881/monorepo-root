"use client";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-[rgb(var(--border))] shrink-0 bg-[rgb(var(--surface))]">
      <div className="mx-auto max-w-5xl flex flex-col items-center gap-3 py-4 text-xs text-[rgb(var(--muted))] px-4 sm:flex-row sm:justify-between sm:h-12 sm:py-0 sm:gap-4">
        {/* Logo & Copyright */}
        <span className="flex items-center gap-1.5">
          <Image
            src="/logo/logo-icon-only.svg"
            alt="Alephdraad"
            width={14}
            height={14}
            className="dark:hidden"
          />
          <Image
            src="/logo/logo-icon-only-dark.svg"
            alt="Alephdraad"
            width={14}
            height={14}
            className="hidden dark:block"
          />
          <span>© {new Date().getFullYear()} Alephdraad</span>
        </span>
        
        {/* Nav links - inline like prompts.chat */}
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/about-content" className="hover:text-[rgb(var(--fg))] transition-colors">
            Tentang
          </Link>
          <Link href="/rules-content" className="hover:text-[rgb(var(--fg))] transition-colors">
            Aturan
          </Link>
          <Link href="/privacy" className="hover:text-[rgb(var(--fg))] transition-colors">
            Privasi
          </Link>
          <Link href="/community-guidelines" className="hover:text-[rgb(var(--fg))] transition-colors">
            Pedoman
          </Link>
          <Link href="/contact-support" className="hover:text-[rgb(var(--fg))] transition-colors">
            Bantuan
          </Link>
          <Link href="/fees" className="hover:text-[rgb(var(--fg))] transition-colors">
            Biaya
          </Link>
          <Link href="/changelog" className="hover:text-[rgb(var(--fg))] transition-colors flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--success))]" />
            v1.0.0
          </Link>
        </nav>
      </div>
    </footer>
  );
}
