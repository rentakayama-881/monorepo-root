"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function WarningsPage() {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchUserId, setSearchUserId] = useState("");
  const [form, setForm] = useState({
    userId: "",
    reason: "",
    severity: "moderate",
    contentType: "",
    contentId: "",
  });

  const fetchWarnings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("admin_token");
      let url = `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/warnings?page=1&pageSize=50`;
      if (searchUserId) {
        url += `&userId=${searchUserId}`;
      }
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Gagal memuat warnings");
      const data = await res.json();
      setWarnings(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [searchUserId]);

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const body = {
        userId: parseInt(form.userId),
        reason: form.reason,
        severity: form.severity,
      };
      if (form.contentType) body.contentType = form.contentType;
      if (form.contentId) body.contentId = form.contentId;

      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/warnings`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Gagal membuat warning");
      setShowCreateModal(false);
      setForm({ userId: "", reason: "", severity: "moderate", contentType: "", contentId: "" });
      fetchWarnings();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const getSeverityBadge = (severity) => {
    const styles = {
      minor: "bg-blue-100 text-blue-800",
      moderate: "bg-yellow-100 text-yellow-800",
      severe: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[severity] || styles.moderate}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">User Warnings</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          + Issue Warning
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Cari berdasarkan User ID..."
          value={searchUserId}
          onChange={(e) => setSearchUserId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground"
        />
        <Button onClick={fetchWarnings} variant="secondary">
          Search
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
      ) : warnings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Tidak ada warnings
        </div>
      ) : (
        <div className="space-y-3">
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityBadge(warning.severity)}
                    {warning.isAcknowledged && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-2">{warning.reason}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>User ID: {warning.userId}</span>
                    {warning.username && <span>Username: {warning.username}</span>}
                    <span>Issued by: Admin {warning.adminId}</span>
                    <span>{new Date(warning.createdAt).toLocaleString("id-ID")}</span>
                  </div>
                  {warning.contentType && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Related: {warning.contentType} - {warning.contentId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Issue Warning</h2>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  User ID *
                </label>
                <input
                  type="number"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Severity *
                </label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Content Type
                  </label>
                  <select
                    value={form.contentType}
                    onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">-</option>
                    <option value="thread">Thread</option>
                    <option value="reply">Reply</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Content ID
                  </label>
                  <input
                    type="text"
                    value={form.contentId}
                    onChange={(e) => setForm({ ...form, contentId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Issuing..." : "Issue Warning"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
