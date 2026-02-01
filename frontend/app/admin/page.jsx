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
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem("admin_token");

      try {
        if (FEATURE_SERVICE_URL) {
          setDepositLoading(true);
          setDepositError("");
          const depositsRes = await fetch(
            `${FEATURE_SERVICE_URL}/api/v1/admin/deposits/pending?limit=20`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (depositsRes.ok) {
            const depositsData = await depositsRes.json();
            setPendingDeposits(depositsData?.data || depositsData || []);
          }
          setDepositLoading(false);
        }

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
        setDepositError("Gagal memuat deposit pending");
        setDepositLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleApproveDeposit = async (depositId) => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/deposits/${depositId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Gagal approve deposit");
      }
      setPendingDeposits((prev) => prev.filter((d) => d.id !== depositId));
    } catch (err) {
      logger.error("Approve deposit failed:", err);
      alert(err?.message || "Gagal approve deposit");
    }
  };

  const handleRejectDeposit = async (depositId) => {
    const reason = window.prompt("Alasan penolakan deposit:");
    if (!reason || reason.trim().length < 3) {
      alert("Alasan penolakan wajib diisi.");
      return;
    }

    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/deposits/${depositId}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Gagal reject deposit");
      }
      setPendingDeposits((prev) => prev.filter((d) => d.id !== depositId));
    } catch (err) {
      logger.error("Reject deposit failed:", err);
      alert(err?.message || "Gagal reject deposit");
    }
  };

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

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Pending Deposits (QRIS)
        </h2>
        {!FEATURE_SERVICE_URL && (
          <p className="text-sm text-muted-foreground">
            Feature Service URL belum dikonfigurasi.
          </p>
        )}
        {depositLoading && (
          <p className="text-sm text-muted-foreground">Memuat deposit pending...</p>
        )}
        {depositError && (
          <p className="text-sm text-destructive">{depositError}</p>
        )}
        {!depositLoading && !depositError && pendingDeposits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Tidak ada deposit pending.
          </p>
        )}
        {!depositLoading && pendingDeposits.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Txn ID</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeposits.map((deposit) => (
                  <tr key={deposit.id} className="border-t border-border">
                    <td className="py-3 pr-4">
                      {deposit.username || `User ${deposit.userId}`}
                    </td>
                    <td className="py-3 pr-4">
                      Rp {Number(deposit.amount).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 pr-4">{deposit.method}</td>
                    <td className="py-3 pr-4">{deposit.externalTransactionId}</td>
                    <td className="py-3 pr-4">
                      {new Date(deposit.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 flex gap-2">
                      <button
                        onClick={() => handleApproveDeposit(deposit.id)}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectDeposit(deposit.id)}
                        className="rounded-md bg-rose-600 px-3 py-1 text-white hover:bg-rose-700"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
