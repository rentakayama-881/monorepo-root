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
    <footer className="mt-auto border-t bg-card shrink-0">
      <div className="container">
        {/* Section Links - Compact inline style */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 py-4 border-b sm:gap-x-8">
          {footerSections.map((section) => (
            <div key={section.title} className="min-w-[110px]">
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              <ul className="space-y-0.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[11px] text-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar - Minimal */}
        <div className="flex flex-col items-center gap-2 py-3 text-[10px] text-muted-foreground sm:flex-row sm:justify-between sm:h-10 sm:py-0">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-1.5">
            <Link href="/" className="flex items-center opacity-60 hover:opacity-100 transition-opacity">
              <Image
                src="/logo/logo-icon-only.svg"
                alt="Alephdraad"
                width={12}
                height={12}
                className="dark:hidden"
              />
              <Image
                src="/logo/logo-icon-only-dark.svg"
                alt="Alephdraad"
                width={12}
                height={12}
                className="hidden dark:block"
              />
            </Link>
            <span>© {new Date().getFullYear()} Alephdraad</span>
          </div>

          {/* Version & Status Badges */}
          <div className="flex items-center gap-1.5">
            <Link 
              href="/changelog" 
              className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] transition-colors hover:border-muted-foreground hover:text-foreground"
            >
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              v1.0.0
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              Operasional
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
