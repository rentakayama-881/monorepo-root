"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchAdminFeatureList, fetchAdminFeature } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/format";

function normalizeWarning(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    userId: item?.userId ?? item?.UserId ?? null,
    username: item?.username ?? item?.Username ?? "",
    adminId: item?.adminId ?? item?.AdminId ?? null,
    reason: item?.reason ?? item?.Reason ?? "",
    severity: item?.severity ?? item?.Severity ?? "moderate",
    isAcknowledged: Boolean(item?.isAcknowledged ?? item?.IsAcknowledged ?? false),
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    contentType: item?.contentType ?? item?.ContentType ?? "",
    contentId: item?.contentId ?? item?.ContentId ?? "",
  };
}

export default function WarningsPage() {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      let url = "/api/v1/admin/moderation/warnings?page=1&pageSize=50";
      if (searchUserId) {
        url += `&userId=${searchUserId}`;
      }
      const items = await fetchAdminFeatureList(url, normalizeWarning);
      setWarnings(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [searchUserId]);

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  const createAction = useAsyncAction(
    async (e) => {
      e.preventDefault();
      const userId = parseInt(form.userId, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error("ID pengguna tidak valid");
      }
      const body = {
        userId,
        reason: form.reason,
        severity: form.severity,
      };
      if (form.contentType) body.contentType = form.contentType;
      if (form.contentId) body.contentId = form.contentId;

      await fetchAdminFeature("/api/v1/admin/moderation/warnings", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setShowCreateModal(false);
      setForm({ userId: "", reason: "", severity: "moderate", contentType: "", contentId: "" });
      fetchWarnings();
    },
    { onError: (e) => alert(e.message) }
  );

  const getSeverityBadge = (severity) => {
    const normalized = String(severity || "moderate").toLowerCase();
    const styles = {
      minor: "border-primary/20 bg-primary/10 text-primary",
      moderate: "border-warning/20 bg-warning/10 text-warning",
      severe: "border-destructive/20 bg-destructive/10 text-destructive",
    };
    const labels = {
      minor: "Ringan",
      moderate: "Sedang",
      severe: "Berat",
    };
    return (
      <span
        className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${
          styles[normalized] || styles.moderate
        }`}
      >
        {labels[normalized] || "Sedang"}
      </span>
    );
  };

  const getContentTypeLabel = (type) => {
    const normalized = String(type || "").toLowerCase();
    const labels = {
      validation_case: "Case Validasi",
    };
    return labels[normalized] || type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Peringatan Pengguna</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ Buat Peringatan</Button>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Cari berdasarkan ID pengguna..."
          value={searchUserId}
          onChange={(e) => setSearchUserId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground"
        />
        <Button onClick={fetchWarnings} variant="secondary">
          Cari
        </Button>
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
      ) : warnings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Tidak ada peringatan</div>
      ) : (
        <div className="space-y-3">
          {warnings.map((warning) => (
            <div key={warning.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityBadge(warning.severity)}
                    {warning.isAcknowledged && (
                      <span className="inline-flex items-center rounded-sm border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        Diakui
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-2">{warning.reason}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>ID Pengguna: {warning.userId}</span>
                    {warning.username && <span>Username: {warning.username}</span>}
                    <span>Diterbitkan oleh: Admin {warning.adminId}</span>
                    <span>{formatDateTime(warning.createdAt)}</span>
                  </div>
                  {warning.contentType && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Terkait: {getContentTypeLabel(warning.contentType)} - {warning.contentId}
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
          <div className="bg-card rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Buat Peringatan</h2>
            </div>

            <form onSubmit={createAction.execute} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  ID Pengguna *
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
                <label className="block text-sm font-medium text-foreground mb-1">Tingkat *</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="minor">Ringan</option>
                  <option value="moderate">Sedang</option>
                  <option value="severe">Berat</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Alasan *</label>
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
                    Tipe Konten
                  </label>
                  <select
                    value={form.contentType}
                    onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">-</option>
                    <option value="validation_case">Case Validasi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    ID Konten
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
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createAction.loading}>
                  {createAction.loading ? "Menerbitkan..." : "Buat Peringatan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
