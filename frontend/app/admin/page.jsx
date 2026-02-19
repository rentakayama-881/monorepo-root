"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";
import { getAdminToken } from "@/lib/adminAuth";

const FEATURE_SERVICE_URL =
  process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";

function unwrapApiData(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return (
    payload.data ??
    payload.Data ??
    payload.result ??
    payload.Result ??
    payload
  );
}

function normalizePendingDepositItem(item) {
  const amountRaw = item?.amount ?? item?.Amount ?? 0;
  return {
    id: item?.id ?? item?.Id ?? item?._id ?? "",
    userId: item?.userId ?? item?.UserId ?? item?.user_id ?? 0,
    username: item?.username ?? item?.Username ?? item?.user_name ?? "",
    amount: Number(amountRaw) || 0,
    method: item?.method ?? item?.Method ?? "QRIS",
    externalTransactionId:
      item?.externalTransactionId ??
      item?.ExternalTransactionId ??
      item?.external_transaction_id ??
      "",
    createdAt:
      item?.createdAt ??
      item?.CreatedAt ??
      item?.created_at ??
      new Date().toISOString(),
  };
}

function normalizePendingDeposits(payload) {
  const root = unwrapApiData(payload);
  let items = [];

  if (Array.isArray(root)) {
    items = root;
  } else if (Array.isArray(root?.items)) {
    items = root.items;
  } else if (Array.isArray(root?.Items)) {
    items = root.Items;
  } else if (Array.isArray(root?.deposits)) {
    items = root.deposits;
  } else if (Array.isArray(root?.Deposits)) {
    items = root.Deposits;
  }

  return items
    .map(normalizePendingDepositItem)
    .filter((item) => Boolean(item.id));
}

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
    pendingReports: 0,
    activeDeviceBans: 0,
    warningsToday: 0,
    hiddenContent: 0,
  });
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");

  const fetchPendingDeposits = async (token) => {
    if (!token) {
      setPendingDeposits([]);
      setDepositError("Sesi admin tidak ditemukan. Silakan login ulang.");
      return;
    }

    setDepositLoading(true);
    setDepositError("");
    try {
      const depositsRes = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/deposits/pending?limit=20`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const depositsData = await depositsRes.json().catch(() => null);
      if (!depositsRes.ok) {
        setDepositError(
          extractApiErrorMessage(depositsData, "Gagal memuat deposit pending")
        );
        setPendingDeposits([]);
      } else {
        setPendingDeposits(normalizePendingDeposits(depositsData));
      }
    } catch (err) {
      logger.error("Failed to fetch pending deposits:", err);
      setDepositError("Gagal memuat deposit pending");
      setPendingDeposits([]);
    } finally {
      setDepositLoading(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      const token = getAdminToken();

      try {
        if (FEATURE_SERVICE_URL) {
          await fetchPendingDeposits(token);
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
              pendingReports:
                Number(modData.pendingReports ?? modData.PendingReports ?? 0) ||
                0,
              activeDeviceBans:
                Number(
                  modData.activeDeviceBans ?? modData.ActiveDeviceBans ?? 0
                ) || 0,
              warningsToday:
                Number(
                  modData.warningsIssuedToday ?? modData.WarningsIssuedToday ?? 0
                ) || 0,
              hiddenContent:
                Number(
                  modData.hiddenContentCount ?? modData.HiddenContentCount ?? 0
                ) || 0,
            }));
          }
        }
      } catch (err) {
        logger.error("Failed to fetch stats:", err);
      }
    };

    fetchStats();
  }, []);

  const handleApproveDeposit = async (depositId) => {
    const token = getAdminToken();
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
        throw new Error(
          extractApiErrorMessage(data, "Gagal approve deposit")
        );
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

    const token = getAdminToken();
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
        throw new Error(
          extractApiErrorMessage(data, "Gagal reject deposit")
        );
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
      color: "text-warning",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      href: "/admin/users",
      color: "text-primary",
    },
    {
      label: "Pending Reports",
      value: stats.pendingReports,
      href: "/admin/reports",
      color: "text-destructive",
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
              <span className="font-medium">Manage Badges</span>
              <p className="text-sm text-muted-foreground">
                Create, edit, or delete badges
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="block rounded-lg px-4 py-3 bg-muted/50 hover:bg-accent transition-colors"
            >
              <span className="font-medium">Manage Users</span>
              <p className="text-sm text-muted-foreground">
                Assign or revoke badges from users
              </p>
            </Link>
            <Link
              href="/admin/integrations/lzt"
              className="block rounded-lg px-4 py-3 bg-muted/50 hover:bg-accent transition-colors"
            >
              <span className="font-medium">LZT Integration</span>
              <p className="text-sm text-muted-foreground">
                Test request Market API dari backend secara aman
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Pending Deposits (QRIS)
          </h2>
          <button
            type="button"
            onClick={() => {
              const token = getAdminToken();
              void fetchPendingDeposits(token);
            }}
            disabled={depositLoading}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {depositLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
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
                        className="rounded-md border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success hover:bg-success/15"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectDeposit(deposit.id)}
                        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/15"
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
