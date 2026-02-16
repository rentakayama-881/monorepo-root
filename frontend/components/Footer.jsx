import Link from "next/link";
import { Logo } from "./ui/Logo";

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
        <span className="flex items-center gap-1.5">
          <Logo variant="icon" size={14} className="opacity-90" />
          &copy; {new Date().getFullYear()} AIvalid
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
        </div>
      </div>
    </footer>
  );
}
