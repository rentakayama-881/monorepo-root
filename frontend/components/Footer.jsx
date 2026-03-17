import Link from "next/link";

const primaryLinks = [
  { href: "/about-content", label: "Tentang" },
  { href: "/fees", label: "Biaya" },
  { href: "/contact-support", label: "Bantuan" },
];

const secondaryLinks = [
  { href: "/privacy", label: "Privasi" },
  { href: "/rules-content", label: "Syarat" },
  { href: "/community-guidelines", label: "Pedoman" },
  { href: "/changelog", label: "Changelog" },
];

export default function Footer() {
  return (
    <footer className="shrink-0 border-t">
      <div className="container flex flex-col items-center gap-2 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:py-3">
        <span className="flex items-center gap-1.5" suppressHydrationWarning>
          &copy; {new Date().getFullYear()} AIValid
        </span>

        <div className="flex flex-col items-center gap-1 sm:items-end">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 sm:justify-end">
            {primaryLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 sm:justify-end">
            {secondaryLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
            <a href="mailto:help@aivalid.id" className="hover:text-foreground">
              help@aivalid.id
            </a>
          </nav>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 sm:justify-end">
            <span className="text-muted-foreground font-medium">Komunitas:</span>
            <a
              href="https://t.me/aivalidid"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Telegram Group
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
