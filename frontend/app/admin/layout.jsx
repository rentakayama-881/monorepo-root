"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { clearAdminSession, getAdminInfo, getAdminToken } from "@/lib/adminAuth";
import useIsClient from "@/lib/useIsClient";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const isClient = useIsClient();
  const isLoginPage = pathname === "/admin/login";

  const admin = useMemo(() => {
    if (!isClient || isLoginPage) return null;

    try {
      const token = getAdminToken();
      const adminInfo = getAdminInfo();
      if (!token || !adminInfo) return null;
      return adminInfo;
    } catch {
      return null;
    }
  }, [isClient, isLoginPage]);

  useEffect(() => {
    if (!isClient || isLoginPage || admin) return;
    router.push("/admin/login");
  }, [admin, isClient, isLoginPage, router]);

  const handleLogout = () => {
    clearAdminSession();
    router.push("/admin/login");
  };

  // Show login page without layout
  if (isLoginPage) {
    return children;
  }

  // Show loading until mounted and auth checked
  if (!isClient || !admin) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_1fr]">
            <Skeleton className="h-[72vh] w-full rounded-2xl" />
            <Skeleton className="h-[72vh] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dasbor" },
    { href: "/admin/users", label: "Pengguna" },
    { href: "/admin/badges", label: "Badge" },
    { href: "/admin/integrations/lzt", label: "Integrasi LZT" },
    { href: "/admin/disputes", label: "Pusat Sengketa" },
    { href: "/admin/observed-devices", label: "Perangkat Terpantau" },
    { href: "/admin/device-bans", label: "Ban Perangkat" },
    { href: "/admin/warnings", label: "Peringatan" },
    { href: "/admin/content", label: "Data Tersembunyi" },
    { href: "/admin/validation-cases", label: "Case Validasi" },
    { href: "/admin/audit-logs", label: "Log Audit" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-card">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-lg font-semibold text-foreground">
              Panel Admin
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-sm border border-warning/20 bg-warning/10 text-warning">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{admin?.name}</span>
            <button onClick={handleLogout} className="text-sm text-destructive hover:opacity-80">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        {/* Sidebar */}
        <aside className="fixed left-0 top-14 bottom-0 w-56 border-r border-border bg-card p-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Kembali ke Website
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-56 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
