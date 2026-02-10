import Link from "next/link";
import { Logo } from "./ui/Logo";

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size={28} className="opacity-90" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground leading-5">AIvalid</div>
              <div className="text-xs text-muted-foreground leading-5">
                Validation Protocol (escrow-backed, stake-gated)
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/rules-content" className="text-muted-foreground hover:text-foreground transition-colors">
              Rules
            </Link>
            <Link href="/fees" className="text-muted-foreground hover:text-foreground transition-colors">
              Fees
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/changelog" className="text-muted-foreground hover:text-foreground transition-colors">
              Changelog
            </Link>
            <a
              href="mailto:help@aivalid.id"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </a>
          </nav>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} AIvalid.</span>
          <span className="font-mono">Institutional-grade validation records.</span>
        </div>
      </div>
    </footer>
  );
}
