import Link from "next/link";
import { Logo } from "./ui/Logo";

const validasiLinks = [
  { href: "/validasi/coding", label: "Validasi Kode Program" },
  { href: "/validasi/riset-ilmiah", label: "Validasi Riset Ilmiah" },
  { href: "/validasi/tugas-kuliah", label: "Cek Tugas Kuliah" },
  { href: "/validasi/dokumen", label: "Validasi Dokumen" },
  { href: "/validasi/ui-ux", label: "Validasi UI/UX" },
  { href: "/validasi/keamanan", label: "Security Review" },
];

const platformLinks = [
  { href: "/validation-cases", label: "Indeks Kasus" },
  { href: "/about-content", label: "Tentang" },
  { href: "/fees", label: "Biaya" },
  { href: "/contact-support", label: "Bantuan" },
];

const legalLinks = [
  { href: "/rules-content", label: "Syarat & Ketentuan" },
  { href: "/privacy", label: "Privasi" },
  { href: "/community-guidelines", label: "Pedoman Komunitas" },
  { href: "/changelog", label: "Catatan Perubahan" },
];

function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">
        {title}
      </h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3">
              <Logo variant="icon" size={28} className="opacity-90" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground leading-5">AIvalid</div>
                <div className="text-xs text-muted-foreground leading-5">
                  Platform Validasi AI Indonesia
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Validasi hasil kerja AI oleh ahli manusia dari berbagai bidang ilmu.
            </p>
          </div>

          {/* Validasi */}
          <FooterColumn title="Validasi" links={validasiLinks} />

          {/* Platform */}
          <FooterColumn title="Platform" links={platformLinks} />

          {/* Legal */}
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-8 flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {new Date().getFullYear()} AIvalid. Hak cipta dilindungi.</span>
          <a
            href="mailto:help@aivalid.id"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            help@aivalid.id
          </a>
        </div>
      </div>
    </footer>
  );
}
