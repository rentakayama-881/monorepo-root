"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import { getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

function normalizeReport(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    status: item?.status ?? item?.Status ?? "pending",
    targetType: item?.targetType ?? item?.TargetType ?? "",
    reason: item?.reason ?? item?.Reason ?? "other",
    description: item?.description ?? item?.Description ?? "",
    reporterUsername: item?.reporterUsername ?? item?.ReporterUsername ?? "",
    reporterUserId: item?.reporterUserId ?? item?.ReporterUserId ?? null,
    reportedUsername: item?.reportedUsername ?? item?.ReportedUsername ?? "",
    reportedUserId: item?.reportedUserId ?? item?.ReportedUserId ?? null,
    targetId: item?.targetId ?? item?.TargetId ?? "",
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
  };
}

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
      const token = getAdminToken();
      if (!token) {
        setReports([]);
        setError("Sesi admin berakhir. Silakan login ulang.");
        return;
      }
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
      const payload = unwrapFeatureData(data);
      const reportsPayload = payload?.reports ?? payload?.Reports ?? payload;
      const items = extractFeatureItems(reportsPayload).map(normalizeReport);
      setReports(items);
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
      const token = getAdminToken();
      if (!token) throw new Error("Sesi admin berakhir. Silakan login ulang.");
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
    const normalized = String(type || "").toLowerCase();
    const labels = {
      thread: "Thread",
      reply: "Balasan",
      user: "User",
    };
    return labels[normalized] || type;
  };

  const getReasonLabel = (reason) => {
    const normalized = String(reason || "").toLowerCase();
    const labels = {
      spam: "Spam",
      harassment: "Pelecehan",
      hate_speech: "Ujaran Kebencian",
      violence: "Kekerasan",
      scam: "Penipuan",
      inappropriate: "Tidak Pantas",
      other: "Lainnya",
    };
    return labels[normalized] || reason;
  };

  const getStatusBadge = (status) => {
    const normalized = String(status || "pending").toLowerCase();
    const styles = {
      pending: "border-warning/20 bg-warning/10 text-warning",
      reviewing: "border-primary/20 bg-primary/10 text-primary",
      resolved: "border-success/20 bg-success/10 text-success",
      dismissed: "border-border bg-muted/60 text-muted-foreground",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
          styles[normalized] || styles.pending
        }`}
      >
        {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
      </span>
    );
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID");
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
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground hover:bg-accent"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
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
                    <span className="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
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
                    <span>{formatDateTime(report.createdAt)}</span>
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
                  <p className="text-sm text-foreground">{formatDateTime(selectedReport.createdAt)}</p>
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

              {String(selectedReport.status || "").toLowerCase() === "pending" && (
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
                      variant="outline"
                      size="sm"
                      className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/15 hover:border-warning/40"
                      onClick={() => handleAction(selectedReport.id, "warning", "Warning issued by admin")}
                      disabled={actionLoading}
                    >
                      Warn User
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-warning/30 bg-warning/15 text-warning hover:bg-warning/20 hover:border-warning/40"
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
