"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState("pending");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/reports?status=${filter}&page=1&pageSize=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Gagal memuat reports");
      const data = await res.json();
      setReports(data.reports || data.items || data.data?.reports || data.data?.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (reportId, action, reason = "") => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/reports/${reportId}/action`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, adminNotes: reason }),
        }
      );
      if (!res.ok) throw new Error("Gagal memproses aksi");
      setSelectedReport(null);
      fetchReports();
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
      user: "User",
    };
    return labels[type] || type;
  };

  const getReasonLabel = (reason) => {
    const labels = {
      spam: "Spam",
      harassment: "Pelecehan",
      hate_speech: "Ujaran Kebencian",
      violence: "Kekerasan",
      scam: "Penipuan",
      inappropriate: "Tidak Pantas",
      other: "Lainnya",
    };
    return labels[reason] || reason;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      reviewing: "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      dismissed: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <div className="flex gap-2">
          {["pending", "reviewing", "resolved", "dismissed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s
                  ? "bg-primary text-white"
                  : "bg-muted/50 text-foreground hover:bg-accent"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
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
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Tidak ada report dengan status {filter}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(report.status)}
                    <span className="px-2 py-0.5 rounded-full text-xs bg-muted/50 text-foreground">
                      {getContentTypeLabel(report.targetType)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">
                      {getReasonLabel(report.reason)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 mb-2">
                    {report.description || "Tidak ada deskripsi"}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Reporter: {report.reporterUsername || report.reporterUserId}</span>
                    <span>
                      Target:{" "}
                      {report.reportedUsername ||
                        report.reportedUserId ||
                        report.targetId}
                    </span>
                    <span>{new Date(report.createdAt).toLocaleString("id-ID")}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Detail Report</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Content Type</label>
                  <p className="text-sm text-foreground">{getContentTypeLabel(selectedReport.targetType)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reason</label>
                  <p className="text-sm text-foreground">{getReasonLabel(selectedReport.reason)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reported At</label>
                  <p className="text-sm text-foreground">{new Date(selectedReport.createdAt).toLocaleString("id-ID")}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <p className="text-sm text-foreground mt-1 p-3 bg-muted/50 rounded-lg">
                  {selectedReport.description || "Tidak ada deskripsi"}
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Reporter</label>
                <p className="text-sm text-foreground">
                  {selectedReport.reporterUsername || "-"} (ID: {selectedReport.reporterUserId})
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Target User</label>
                <p className="text-sm text-foreground">
                  {selectedReport.reportedUsername || "-"} (ID: {selectedReport.reportedUserId || "-"})
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Content ID</label>
                <p className="text-sm text-foreground font-mono">{selectedReport.targetId}</p>
              </div>

              {selectedReport.status === "pending" && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-foreground mb-3">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAction(selectedReport.id, "none", "Dismissed")}
                      disabled={actionLoading}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      onClick={() => handleAction(selectedReport.id, "warning", "Warning issued by admin")}
                      disabled={actionLoading}
                    >
                      Warn User
                    </Button>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => handleAction(selectedReport.id, "hide", "Content hidden")}
                      disabled={actionLoading}
                    >
                      Hide Content
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleAction(selectedReport.id, "delete", "Content deleted")}
                      disabled={actionLoading}
                    >
                      Delete Content
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleAction(selectedReport.id, "ban_user", "User banned")}
                      disabled={actionLoading}
                    >
                      Ban User
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleAction(selectedReport.id, "ban_device", "Device banned")}
                      disabled={actionLoading}
                    >
                      Ban Device
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
