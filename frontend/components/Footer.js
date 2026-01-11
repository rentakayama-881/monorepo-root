"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

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

const socialLinks = [
  { 
    name: "GitHub", 
    href: "https://github.com/alephdraad", 
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    )
  },
  { 
    name: "Twitter", 
    href: "https://twitter.com/alephdraad", 
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  { 
    name: "Discord", 
    href: "https://discord.gg/alephdraad", 
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    )
  },
];

export default function Footer() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <>
      {/* Back to top button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-primary p-3 text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring animate-slide-up"
          aria-label="Kembali ke atas"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      <footer className="mt-auto border-t bg-gradient-to-b from-card to-secondary/30 shrink-0">
        <div className="container">
          {/* Main Footer Content */}
          <div className="py-8 border-b">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8">
              {footerSections.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="link-underline text-sm text-foreground/80 transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Social Media & Newsletter Section */}
          <div className="py-6 border-b">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <div className="flex flex-col items-center gap-3 sm:items-start">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ikuti Kami
                </h3>
                <div className="flex gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:scale-110"
                      aria-label={social.name}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>
              
              {/* Newsletter (placeholder) */}
              <div className="flex flex-col items-center gap-2 sm:items-end">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tetap Terhubung
                </h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Email Anda"
                    className="rounded-[var(--radius)] border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-all w-48"
                  />
                  <button className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col items-center gap-3 py-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            {/* Logo & Copyright */}
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center opacity-60 hover:opacity-100 transition-opacity">
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
              </Link>
              <span>© {new Date().getFullYear()} Alephdraad. All rights reserved.</span>
            </div>

            {/* Version & Status Badges */}
            <div className="flex items-center gap-2">
              <Link 
                href="/changelog" 
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-all hover:border-primary hover:text-primary"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                v1.0.0
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operasional
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
