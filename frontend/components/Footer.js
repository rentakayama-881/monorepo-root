"use client";
import Link from "next/link";
import Image from "next/image";

const footerSections = [
  {
    title: "Platform",
    links: [
      { href: "/category/akun-digital", label: "Digital Goods & Services" },
      { href: "/ai-search", label: "AI Search" },
      { href: "/fees", label: "Biaya Layanan" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { href: "/about-content", label: "Tentang Kami" },
      { href: "/contact-support", label: "Hubungi Kami" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/rules-content", label: "Syarat Ketentuan" },
      { href: "/privacy", label: "Kebijakan Privasi" },
      { href: "/community-guidelines", label: "Pedoman Komunitas" },
    ],
  },
  {
    title: "Sumber Daya",
    links: [
      { href: "/contact-support#faq", label: "FAQ" },
      { href: "mailto:help@alephdraad.fun", label: "Dukungan" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Section Links - Inline style like prompts.chat */}
        <div className="flex flex-wrap gap-x-8 gap-y-6 pb-6 border-b border-[rgb(var(--border))]">
          {footerSections.map((section) => (
            <div key={section.title} className="min-w-[140px]">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[rgb(var(--fg))] transition-colors hover:text-[rgb(var(--brand))]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar - Compact inline like prompts.chat */}
        <div className="flex flex-col items-center gap-3 pt-6 text-xs text-[rgb(var(--muted))] sm:flex-row sm:justify-between">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
              <Image
                src="/logo/logo-icon-only.svg"
                alt="Alephdraad"
                width={16}
                height={16}
                className="dark:hidden"
              />
              <Image
                src="/logo/logo-icon-only-dark.svg"
                alt="Alephdraad"
                width={16}
                height={16}
                className="hidden dark:block"
              />
            </Link>
            <span>© {new Date().getFullYear()} Alephdraad. All rights reserved.</span>
          </div>

          {/* Version & Status Badges */}
          <div className="flex items-center gap-2">
            <Link 
              href="/changelog" 
              className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-0.5 text-[11px] transition-colors hover:border-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              v1.0.0
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--success))]/30 bg-[rgb(var(--success))]/10 px-2 py-0.5 text-[11px] text-[rgb(var(--success))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--success))] animate-pulse" />
              Operasional
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
