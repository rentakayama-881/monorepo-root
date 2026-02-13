import Link from "next/link";
import { Logo } from "./ui/Logo";

const quickLinks = [
  { href: "/validation-cases", label: "Case Index" },
  { href: "/fees", label: "Biaya" },
  { href: "/privacy", label: "Privasi" },
  { href: "/rules-content", label: "Syarat" },
  { href: "/contact-support", label: "Bantuan" },
];

export default function Footer() {
  return (
    <footer className="shrink-0 border-t">
      <div className="container flex flex-col items-center gap-3 py-4 text-xs text-muted-foreground sm:h-10 sm:flex-row sm:justify-between sm:gap-4 sm:py-0">
        <span className="flex items-center gap-1.5">
          <Logo variant="icon" size={14} className="opacity-90" />
          &copy; {new Date().getFullYear()} AIvalid
        </span>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a href="mailto:help@aivalid.id" className="hover:text-foreground">
            help@aivalid.id
          </a>
        </nav>
      </div>
    </footer>
  );
}
