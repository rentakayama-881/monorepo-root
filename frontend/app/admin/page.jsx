"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { CenteredSpinner } from "@/components/ui/LoadingState";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";
import { getAdminToken } from "@/lib/adminAuth";
import { unwrapApiData } from "@/lib/apiHelpers";

const FEATURE_SERVICE_URL =
  process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";

function extractApiErrorMessage(payload, fallback) {
  return (
    payload?.error?.message ||
    payload?.error?.Message ||
    payload?.message ||
    payload?.Message ||
    fallback
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalBadges: 0,
    totalUsers: 0,
    activeDeviceBans: 0,
    warningsToday: 0,
    hiddenContent: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const token = getAdminToken();

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
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            }
          );
          if (modStatsRes.ok) {
            const modPayload = await modStatsRes.json().catch(() => null);
            const modData = unwrapApiData(modPayload) || {};
            setStats((prev) => ({
              ...prev,
              activeDeviceBans:
                Number(modData.activeDeviceBans ?? modData.ActiveDeviceBans ?? 0) || 0,
              warningsToday:
                Number(modData.warningsIssuedToday ?? modData.WarningsIssuedToday ?? 0) || 0,
              hiddenContent:
                Number(modData.hiddenContentCount ?? modData.HiddenContentCount ?? 0) || 0,
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
      color: "text-warning",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      href: "/admin/users",
      color: "text-primary",
    },
    {
      label: "Active Bans",
      value: stats.activeDeviceBans,
      href: "/admin/device-bans",
      color: "text-warning",
    },
    {
      label: "Warnings Today",
      value: stats.warningsToday,
      href: "/admin/warnings",
      color: "text-warning",
    },
    {
      label: "Hidden Records",
      value: stats.hiddenContent,
      href: "/admin/content",
      color: "text-muted-foreground",
    },
    {
      label: "LZT API",
      value: "Ready",
      href: "/admin/integrations/lzt",
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Selamat datang di Admin Panel</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="group p-5 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/admin/badges"
              className="block rounded-lg px-4 py-3 bg-muted/30 hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">Manage Badges</span>
              <p className="text-sm text-muted-foreground">Create, edit, or delete badges</p>
            </Link>
            <Link
              href="/admin/users"
              className="block rounded-lg px-4 py-3 bg-muted/30 hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">Manage Users</span>
              <p className="text-sm text-muted-foreground">Assign or revoke badges from users</p>
            </Link>
            <Link
              href="/admin/integrations/lzt"
              className="block rounded-lg px-4 py-3 bg-muted/30 hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">LZT Integration</span>
              <p className="text-sm text-muted-foreground">
                Test request Market API dari backend secara aman
              </p>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Info</h2>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Badge adalah bentuk apresiasi untuk user atas pencapaian mereka. Badge ditampilkan di
              profil user dan satu badge dapat dipilih sebagai primary badge yang muncul di sebelah
              username.
            </p>
            <p className="text-muted-foreground">
              Untuk memberikan badge, cari user di menu Users, lalu pilih badge yang ingin
              diberikan.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
