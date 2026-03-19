"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchAdminFeatureList, fetchAdminFeature } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/format";

function normalizeDeviceBan(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    deviceFingerprint:
      item?.deviceFingerprint ?? item?.DeviceFingerprint ?? item?.fingerprint ?? "",
    userId: item?.userId ?? item?.UserId ?? null,
    reason: item?.reason ?? item?.Reason ?? "",
    isPermanent: Boolean(item?.isPermanent ?? item?.IsPermanent ?? false),
    isActive: Boolean(item?.isActive ?? item?.IsActive ?? false),
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    expiresAt: item?.expiresAt ?? item?.ExpiresAt ?? null,
  };
}

export default function DeviceBansPage() {
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    deviceFingerprint: "",
    userId: "",
    reason: "",
    isPermanent: false,
    expiresAt: "",
  });

  const fetchBans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchAdminFeatureList(
        "/api/v1/admin/moderation/device-bans?page=1&pageSize=50",
        normalizeDeviceBan
      );
      setBans(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  const createAction = useAsyncAction(
    async (e) => {
      e.preventDefault();
      const body = {
        deviceFingerprint: form.deviceFingerprint,
        userId: form.userId ? parseInt(form.userId, 10) : null,
        reason: form.reason,
        isPermanent: form.isPermanent,
      };
      if (!form.isPermanent && form.expiresAt) {
        body.expiresAt = new Date(form.expiresAt).toISOString();
      }
      await fetchAdminFeature("/api/v1/admin/moderation/device-bans", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setShowCreateModal(false);
      setForm({ deviceFingerprint: "", userId: "", reason: "", isPermanent: false, expiresAt: "" });
      fetchBans();
    },
    { onError: (e) => alert(e.message) }
  );

  const unbanAction = useAsyncAction(
    async (banId) => {
      await fetchAdminFeature(`/api/v1/admin/moderation/device-bans/${banId}`, {
        method: "DELETE",
      });
      fetchBans();
    },
    { onError: (e) => alert(e.message) }
  );

  const getBanStatus = (ban) => {
    if (ban.isPermanent) {
      return "Permanent";
    }
    if (!ban.isActive) {
      return "Inactive";
    }
    // Check if temporary ban has expired
    if (ban.expiresAt) {
      const expiryDate = new Date(ban.expiresAt);
      if (expiryDate < new Date()) {
        return "Expired";
      }
      return "Active";
    }
    return "Active";
  };

  const getBanStatusLabel = (status) => {
    switch (status) {
      case "Permanent":
        return "Permanen";
      case "Inactive":
        return "Tidak Aktif";
      case "Expired":
        return "Kedaluwarsa";
      case "Active":
      default:
        return "Aktif";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ban Perangkat</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ Buat Ban Perangkat</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : bans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Tidak ada device ban aktif</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Daftar blokir perangkat">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Fingerprint Perangkat
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">User ID</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Alasan</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Dibuat</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Berakhir</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((ban) => {
                const status = getBanStatus(ban);
                const statusColor =
                  status === "Permanent"
                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                    : status === "Active"
                      ? "border-warning/20 bg-warning/10 text-warning"
                      : "border-border bg-muted/60 text-muted-foreground";

                return (
                  <tr key={ban.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 font-mono text-xs truncate max-w-48">
                      {ban.deviceFingerprint}
                    </td>
                    <td className="py-3 px-4">
                      {ban.userId ? <span className="font-mono text-xs">{ban.userId}</span> : "-"}
                    </td>
                    <td className="py-3 px-4 max-w-48 truncate">{ban.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${statusColor}`}
                      >
                        {getBanStatusLabel(status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {formatDateTime(ban.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {ban.isPermanent ? "-" : formatDateTime(ban.expiresAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={unbanAction.loading}
                        onClick={() => {
                          if (confirm("Yakin ingin menghapus ban ini?")) {
                            unbanAction.execute(ban.id);
                          }
                        }}
                      >
                        Cabut Ban
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Buat Ban Perangkat</h2>
            </div>

            <form onSubmit={createAction.execute} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Fingerprint Perangkat *
                </label>
                <input
                  type="text"
                  value={form.deviceFingerprint}
                  onChange={(e) => setForm({ ...form, deviceFingerprint: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  aria-label="Device Fingerprint"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  User ID (opsional)
                </label>
                <input
                  type="number"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  aria-label="User ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Alasan *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  aria-label="Reason"
                  rows={3}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPermanent"
                  checked={form.isPermanent}
                  onChange={(e) => setForm({ ...form, isPermanent: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="isPermanent" className="text-sm text-foreground">
                  Ban Permanen
                </label>
              </div>

              {!form.isPermanent && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Berakhir Pada
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                    aria-label="Expires At"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createAction.loading}>
                  {createAction.loading ? "Membuat..." : "Buat Ban"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
