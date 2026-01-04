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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg))]">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-[rgb(var(--muted))] transition hover:text-[rgb(var(--fg))]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center gap-4 border-t border-[rgb(var(--border))] pt-6 sm:flex-row sm:justify-between">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo/logo-icon-only.svg"
                alt="Alephdraad"
                width={20}
                height={20}
                className="dark:hidden"
              />
              <Image
                src="/logo/logo-icon-only-dark.svg"
                alt="Alephdraad"
                width={20}
                height={20}
                className="hidden dark:block"
              />
            </Link>
            <span className="text-xs text-[rgb(var(--muted))]">
              © {new Date().getFullYear()} PT ALEPHDRAAD UTILITY STACK
            </span>
          </div>

          {/* Version & Status */}
          <div className="flex items-center gap-4 text-xs text-[rgb(var(--muted))]">
            <Link href="/changelog" className="flex items-center gap-1.5 transition hover:text-[rgb(var(--fg))]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span>v1.0.0</span>
            </Link>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[rgb(var(--success))]" />
              <span>Operasional</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
