"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalBadges: 0,
    totalUsers: 0,
    pendingReports: 0,
    activeDeviceBans: 0,
    warningsToday: 0,
    hiddenContent: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem("admin_token");

      try {
        // Fetch badges count from Go backend
        const badgesRes = await fetch(`${getApiBase()}/admin/badges`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (badgesRes.ok) {
          const data = await badgesRes.json();
          setStats((prev) => ({
            ...prev,
            totalBadges: data.badges?.length || 0,
          }));
        }

        // Fetch users count from Go backend
        const usersRes = await fetch(`${getApiBase()}/admin/users?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setStats((prev) => ({ ...prev, totalUsers: data.total || 0 }));
        }

        // Fetch moderation stats from Feature Service
        if (FEATURE_SERVICE_URL) {
          const modStatsRes = await fetch(
            `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/dashboard`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (modStatsRes.ok) {
            const modData = await modStatsRes.json();
            setStats((prev) => ({
              ...prev,
              pendingReports: modData.pendingReports || 0,
              activeDeviceBans: modData.activeDeviceBans || 0,
              warningsToday: modData.warningsIssuedToday || 0,
              hiddenContent: modData.hiddenContentCount || 0,
            }));
          }
        }
      } catch (err) {
        logger.error("Failed to fetch stats:", err);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Total Badges",
      value: stats.totalBadges,
      href: "/admin/badges",
      icon: "🏆",
      color: "text-amber-600",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      href: "/admin/users",
      icon: "👥",
      color: "text-blue-600",
    },
    {
      label: "Pending Reports",
      value: stats.pendingReports,
      href: "/admin/reports",
      icon: "🚨",
      color: "text-red-600",
    },
    {
      label: "Active Bans",
      value: stats.activeDeviceBans,
      href: "/admin/device-bans",
      icon: "🔒",
      color: "text-orange-600",
    },
    {
      label: "Warnings Today",
      value: stats.warningsToday,
      href: "/admin/warnings",
      icon: "⚠️",
      color: "text-yellow-600",
    },
    {
      label: "Hidden Content",
      value: stats.hiddenContent,
      href: "/admin/content",
      icon: "👁️",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Selamat datang di Admin Panel
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="p-6 hover:border-primary transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{stat.icon}</span>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Link
              href="/admin/badges"
              className="block rounded-lg px-4 py-3 bg-muted/50 hover:bg-accent transition-colors"
            >
              <span className="font-medium">🏆 Manage Badges</span>
              <p className="text-sm text-muted-foreground">
                Create, edit, or delete badges
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="block rounded-lg px-4 py-3 bg-muted/50 hover:bg-accent transition-colors"
            >
              <span className="font-medium">👥 Manage Users</span>
              <p className="text-sm text-muted-foreground">
                Assign or revoke badges from users
              </p>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Info
          </h2>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Badge adalah bentuk apresiasi untuk user atas pencapaian mereka.
              Badge ditampilkan di profil user dan satu badge dapat dipilih
              sebagai primary badge yang muncul di sebelah username.
            </p>
            <p className="text-muted-foreground">
              Untuk memberikan badge, cari user di menu Users, lalu pilih badge
              yang ingin diberikan.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
