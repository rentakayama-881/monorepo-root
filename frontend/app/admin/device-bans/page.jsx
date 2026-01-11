"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function DeviceBansPage() {
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
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
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/device-bans?page=1&pageSize=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Gagal memuat device bans");
      const data = await res.json();
      setBans(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const body = {
        deviceFingerprint: form.deviceFingerprint,
        userId: form.userId ? parseInt(form.userId) : null,
        reason: form.reason,
        isPermanent: form.isPermanent,
      };
      if (!form.isPermanent && form.expiresAt) {
        body.expiresAt = new Date(form.expiresAt).toISOString();
      }

      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/device-bans`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Gagal membuat device ban");
      setShowCreateModal(false);
      setForm({ deviceFingerprint: "", userId: "", reason: "", isPermanent: false, expiresAt: "" });
      fetchBans();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUnban = async (banId) => {
    if (!confirm("Yakin ingin menghapus ban ini?")) return;
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/device-bans/${banId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) throw new Error("Gagal menghapus ban");
      fetchBans();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Device Bans</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          + New Device Ban
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : bans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Tidak ada device ban aktif
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Device Fingerprint</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">User ID</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expires</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((ban) => (
                <tr key={ban.id} className="border-b border-border hover:bg-muted/50">
                  <td className="py-3 px-4 font-mono text-xs truncate max-w-48">{ban.deviceFingerprint}</td>
                  <td className="py-3 px-4">{ban.userId || "-"}</td>
                  <td className="py-3 px-4 max-w-48 truncate">{ban.reason}</td>
                  <td className="py-3 px-4">
                    {ban.isPermanent ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">Permanent</span>
                    ) : ban.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">Expired</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {new Date(ban.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {ban.isPermanent ? "-" : ban.expiresAt ? new Date(ban.expiresAt).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleUnban(ban.id)}
                    >
                      Unban
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Create Device Ban</h2>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Device Fingerprint *
                </label>
                <input
                  type="text"
                  value={form.deviceFingerprint}
                  onChange={(e) => setForm({ ...form, deviceFingerprint: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  User ID (optional)
                </label>
                <input
                  type="number"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Reason *
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
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
                  Permanent Ban
                </label>
              </div>

              {!form.isPermanent && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Expires At
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Ban"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
