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
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [badgesRes, usersRes, modStatsRes] = await Promise.allSettled([
          fetch(`${getApiBase()}/admin/badges`, { headers }),
          fetch(`${getApiBase()}/admin/users?limit=1`, { headers }),
          FEATURE_SERVICE_URL
            ? fetch(`${FEATURE_SERVICE_URL}/api/v1/admin/moderation/dashboard`, {
                cache: "no-store",
                headers: { ...headers, Accept: "application/json" },
              })
            : Promise.resolve(null),
        ]);

        const next = {};

        if (badgesRes.status === "fulfilled" && badgesRes.value?.ok) {
          const data = await badgesRes.value.json();
          next.totalBadges = data.badges?.length || 0;
        }

        if (usersRes.status === "fulfilled" && usersRes.value?.ok) {
          const data = await usersRes.value.json();
          next.totalUsers = data.total || 0;
        }

        if (modStatsRes.status === "fulfilled" && modStatsRes.value?.ok) {
          const modPayload = await modStatsRes.value.json().catch(() => null);
          const modData = unwrapApiData(modPayload) || {};
          next.activeDeviceBans =
            Number(modData.activeDeviceBans ?? modData.ActiveDeviceBans ?? 0) || 0;
          next.warningsToday =
            Number(modData.warningsIssuedToday ?? modData.WarningsIssuedToday ?? 0) || 0;
          next.hiddenContent =
            Number(modData.hiddenContentCount ?? modData.HiddenContentCount ?? 0) || 0;
        }

        setStats((prev) => ({ ...prev, ...next }));
      } catch (err) {
        logger.error("Failed to fetch stats:", err);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Total Badge",
      value: stats.totalBadges,
      href: "/admin/badges",
      color: "text-warning",
    },
    {
      label: "Total Pengguna",
      value: stats.totalUsers,
      href: "/admin/users",
      color: "text-primary",
    },
    {
      label: "Ban Aktif",
      value: stats.activeDeviceBans,
      href: "/admin/device-bans",
      color: "text-warning",
    },
    {
      label: "Peringatan Hari Ini",
      value: stats.warningsToday,
      href: "/admin/warnings",
      color: "text-warning",
    },
    {
      label: "Data Disembunyikan",
      value: stats.hiddenContent,
      href: "/admin/content",
      color: "text-muted-foreground",
    },
    {
      label: "LZT API",
      value: "Siap",
      href: "/admin/integrations/lzt",
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dasbor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Selamat datang di panel admin</p>
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
          <h2 className="text-lg font-semibold text-foreground mb-4">Aksi Cepat</h2>
          <div className="space-y-2">
            <Link
              href="/admin/badges"
              className="block rounded-lg px-4 py-3 bg-muted/30 hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">Kelola Badge</span>
              <p className="text-sm text-muted-foreground">Buat, ubah, atau hapus badge</p>
            </Link>
            <Link
              href="/admin/users"
              className="block rounded-lg px-4 py-3 bg-muted/30 hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">Kelola Pengguna</span>
              <p className="text-sm text-muted-foreground">
                Berikan atau cabut badge dari pengguna
              </p>
            </Link>
            <Link
              href="/admin/integrations/lzt"
              className="block rounded-lg px-4 py-3 bg-muted/30 hover:bg-accent transition-colors"
            >
              <span className="font-medium text-foreground">Integrasi LZT</span>
              <p className="text-sm text-muted-foreground">
                Uji request Market API dari backend secara aman
              </p>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Informasi</h2>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Badge adalah bentuk apresiasi untuk pengguna atas pencapaian mereka. Badge ditampilkan
              di profil pengguna dan satu badge dapat dipilih sebagai badge utama yang muncul di
              sebelah username.
            </p>
            <p className="text-muted-foreground">
              Untuk memberikan badge, cari pengguna di menu Pengguna, lalu pilih badge yang ingin
              diberikan.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
