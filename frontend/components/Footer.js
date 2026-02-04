"use client";
import Link from "next/link";
import { Logo } from "./ui/Logo";

const footerSections = [
  {
    title: "Platform",
    links: [
      { href: "", label: "Community & Services" },
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
      { href: "mailto:help@aivalid.id", label: "Dukungan" },
    ],
  },
];

// Telegram SVG icon
function TelegramIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

export default function Footer() {
  return (
    <>
      <footer className="mt-auto border-t bg-background shrink-0">
        <div className="container py-8 md:py-12">
          {/* Main grid */}
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            {/* Column 1: Brand + Telegram */}
            <div className="space-y-4">
              <Logo
                variant="icon"
                size={32}
                className="opacity-80 hover:opacity-100 transition-opacity"
              />
              <p className="text-sm text-muted-foreground">
                Platform komunitas digital untuk forum, marketplace, dan pertukaran pengetahuan.
              </p>
              <a 
                href="https://t.me/aivalid" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <TelegramIcon className="h-4 w-4" />
                Telegram
              </a>
            </div>
            
            {/* Columns 2-5: Link sections */}
            {footerSections.map((section) => (
              <div key={section.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} AIvalid. All rights reserved.</span>
            <div className="flex items-center gap-2">
              <Link 
                href="/changelog" 
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors hover:border-foreground hover:text-foreground"
              >
                v1.0.0
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
