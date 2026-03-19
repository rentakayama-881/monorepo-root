"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchAdminFeature, fetchAdminFeatureList } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/format";

function normalizeHiddenContent(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    contentType: item?.contentType ?? item?.ContentType ?? "",
    contentId: item?.contentId ?? item?.ContentId ?? "",
    reason: item?.reason ?? item?.Reason ?? "",
    adminId: item?.adminId ?? item?.AdminId ?? null,
    hiddenAt: item?.hiddenAt ?? item?.HiddenAt ?? item?.createdAt ?? item?.CreatedAt ?? null,
  };
}

export default function HiddenContentPage() {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHideModal, setShowHideModal] = useState(false);
  const [form, setForm] = useState({
    contentType: "validation_case",
    contentId: "",
    reason: "",
  });

  const fetchContents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchAdminFeatureList(
        "/api/v1/admin/moderation/content/hidden?page=1&pageSize=50",
        normalizeHiddenContent
      );
      setContents(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const hideAction = useAsyncAction(
    async (e) => {
      e.preventDefault();
      await fetchAdminFeature("/api/v1/admin/moderation/content/hide", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowHideModal(false);
      setForm({ contentType: "validation_case", contentId: "", reason: "" });
      fetchContents();
    },
    { onError: (e) => alert(e.message) }
  );

  const unhideAction = useAsyncAction(
    async (hiddenContentId) => {
      await fetchAdminFeature(`/api/v1/admin/moderation/content/unhide/${hiddenContentId}`, {
        method: "POST",
      });
      fetchContents();
    },
    { onError: (e) => alert(e.message) }
  );

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
        <h1 className="text-2xl font-bold text-foreground">Data Tersembunyi</h1>
        <Button onClick={() => setShowHideModal(true)}>+ Sembunyikan Data</Button>
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
      ) : contents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Tidak ada data tersembunyi</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipe</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID Konten</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Alasan</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Disembunyikan Oleh
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Disembunyikan Pada
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {contents.map((content) => (
                <tr key={content.id} className="border-b border-border hover:bg-muted/50">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-sm text-xs bg-muted/50 text-foreground">
                      {getContentTypeLabel(content.contentType)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{content.contentId}</td>
                  <td className="py-3 px-4 max-w-48 truncate">{content.reason}</td>
                  <td className="py-3 px-4">Admin {content.adminId}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formatDateTime(content.hiddenAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (confirm("Yakin ingin menampilkan kembali data ini?")) {
                          unhideAction.execute(content.id);
                        }
                      }}
                      disabled={unhideAction.loading}
                    >
                      Tampilkan
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hide Modal */}
      {showHideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Sembunyikan Data</h2>
            </div>

            <form onSubmit={hideAction.execute} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Tipe Konten *
                </label>
                <select
                  value={form.contentType}
                  onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="validation_case">Case Validasi</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  ID Konten *
                </label>
                <input
                  type="text"
                  value={form.contentId}
                  onChange={(e) => setForm({ ...form, contentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  required
                />
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

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowHideModal(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={hideAction.loading}>
                  {hideAction.loading ? "Menyembunyikan..." : "Sembunyikan Data"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
