"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function HiddenContentPage() {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHideModal, setShowHideModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState({
    contentType: "thread",
    contentId: "",
    reason: "",
  });

  const fetchContents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/content/hidden?page=1&pageSize=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Gagal memuat hidden content");
      const data = await res.json();
      setContents(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const handleHide = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/content/hide`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error("Gagal menyembunyikan konten");
      setShowHideModal(false);
      setForm({ contentType: "thread", contentId: "", reason: "" });
      fetchContents();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnhide = async (contentType, contentId) => {
    if (!confirm("Yakin ingin menampilkan kembali konten ini?")) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/content/unhide`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contentType, contentId }),
        }
      );
      if (!res.ok) throw new Error("Gagal menampilkan konten");
      fetchContents();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getContentTypeLabel = (type) => {
    const labels = {
      thread: "Thread",
      reply: "Balasan",
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Hidden Content</h1>
        <Button onClick={() => setShowHideModal(true)}>
          + Hide Content
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
      ) : contents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Tidak ada konten tersembunyi
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Content ID</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hidden By</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hidden At</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contents.map((content) => (
                <tr key={content.id} className="border-b border-border hover:bg-muted/50">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-muted/50 text-foreground">
                      {getContentTypeLabel(content.contentType)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{content.contentId}</td>
                  <td className="py-3 px-4 max-w-48 truncate">{content.reason}</td>
                  <td className="py-3 px-4">Admin {content.adminId}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {new Date(content.hiddenAt).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleUnhide(content.contentType, content.contentId)}
                      disabled={actionLoading}
                    >
                      Unhide
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
          <div className="bg-card rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Hide Content</h2>
            </div>

            <form onSubmit={handleHide} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Content Type *
                </label>
                <select
                  value={form.contentType}
                  onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="thread">Thread</option>
                  <option value="reply">Reply</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Content ID *
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

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowHideModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Hiding..." : "Hide Content"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
