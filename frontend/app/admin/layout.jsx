"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Wait for client-side mount before accessing localStorage
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Skip if not mounted yet (SSR) or on login page
    if (!mounted) return;
    
    if (pathname === "/admin/login") {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("admin_token");
      const adminInfo = localStorage.getItem("admin_info");

      if (!token || !adminInfo) {
        router.push("/admin/login");
        return;
      }

      setAdmin(JSON.parse(adminInfo));
    } catch {
      router.push("/admin/login");
      return;
    }

    setLoading(false);
  }, [pathname, router, mounted]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_info");
    router.push("/admin/login");
  };

  // Show login page without layout
  if (pathname === "/admin/login") {
    return children;
  }

  // Show loading until mounted and auth checked
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "🏠" },
    { href: "/admin/badges", label: "Badges", icon: "🏆" },
    { href: "/admin/users", label: "Users", icon: "👥" },
    { href: "/admin/disputes", label: "Disputes", icon: "⚖️" },
    { href: "/admin/reports", label: "Reports", icon: "🚨" },
    { href: "/admin/device-bans", label: "Device Bans", icon: "🔒" },
    { href: "/admin/warnings", label: "Warnings", icon: "⚠️" },
    { href: "/admin/content", label: "Hidden Content", icon: "👁️" },
    { href: "/admin/threads", label: "Thread Mgmt", icon: "📝" },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: "📋" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-card">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-lg font-semibold text-foreground"
            >
              Admin Panel
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {admin?.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-destructive hover:opacity-80"
            >
              Logout
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
                <span>{item.icon}</span>
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
