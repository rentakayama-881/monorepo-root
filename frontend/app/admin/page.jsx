"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalBadges: 0,
    totalUsers: 0,
    assignedBadges: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem("admin_token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

      try {
        // Fetch badges count
        const badgesRes = await fetch(`${API_URL}/admin/badges`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (badgesRes.ok) {
          const data = await badgesRes.json();
          setStats((prev) => ({
            ...prev,
            totalBadges: data.badges?.length || 0,
          }));
        }

        // Fetch users count
        const usersRes = await fetch(`${API_URL}/admin/users?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setStats((prev) => ({ ...prev, totalUsers: data.total || 0 }));
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Dashboard</h1>
        <p className="mt-1 text-[rgb(var(--muted))]">
          Selamat datang di Admin Panel
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="p-6 hover:border-[rgb(var(--brand))] transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{stat.icon}</span>
                <div>
                  <p className="text-sm text-[rgb(var(--muted))]">
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
          <h2 className="text-lg font-semibold text-[rgb(var(--fg))] mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Link
              href="/admin/badges"
              className="block rounded-md px-4 py-3 bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--border))] transition-colors"
            >
              <span className="font-medium">🏆 Manage Badges</span>
              <p className="text-sm text-[rgb(var(--muted))]">
                Create, edit, or delete badges
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="block rounded-md px-4 py-3 bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--border))] transition-colors"
            >
              <span className="font-medium">👥 Manage Users</span>
              <p className="text-sm text-[rgb(var(--muted))]">
                Assign or revoke badges from users
              </p>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[rgb(var(--fg))] mb-4">
            Info
          </h2>
          <div className="space-y-3 text-sm">
            <p className="text-[rgb(var(--muted))]">
              Badge adalah bentuk apresiasi untuk user atas pencapaian mereka.
              Badge ditampilkan di profil user dan satu badge dapat dipilih
              sebagai primary badge yang muncul di sebelah username.
            </p>
            <p className="text-[rgb(var(--muted))]">
              Untuk memberikan badge, cari user di menu Users, lalu pilih badge
              yang ingin diberikan.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
