"use client";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo/logo-icon-only.svg"
                alt="Alephdraad"
                width={24}
                height={24}
                className="dark:hidden"
              />
              <Image
                src="/logo/logo-icon-only-dark.svg"
                alt="Alephdraad"
                width={24}
                height={24}
                className="hidden dark:block"
              />
            </Link>
            <span className="text-xs text-[rgb(var(--muted))]">
              © {new Date().getFullYear()} Alephdraad
            </span>
          </div>

          {/* Footer Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
            <Link
              href="/about-content"
              className="text-[rgb(var(--muted))] transition hover:text-[rgb(var(--fg))]"
            >
              Tentang
            </Link>
            <Link
              href="/rules-content"
              className="text-[rgb(var(--muted))] transition hover:text-[rgb(var(--fg))]"
            >
              Aturan
            </Link>
            <Link
              href="/contact-support"
              className="text-[rgb(var(--muted))] transition hover:text-[rgb(var(--fg))]"
            >
              Bantuan
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
