"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import { getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

function normalizeAuditLog(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    adminName: item?.adminName ?? item?.AdminName ?? "",
    adminId: item?.adminId ?? item?.AdminId ?? null,
    actionType: item?.actionType ?? item?.ActionType ?? "unknown",
    targetType: item?.targetType ?? item?.TargetType ?? "",
    targetId: item?.targetId ?? item?.TargetId ?? "",
    targetUserId: item?.targetUserId ?? item?.TargetUserId ?? null,
    details: item?.details ?? item?.Details ?? "",
    reason: item?.reason ?? item?.Reason ?? "",
    metadata: item?.metadata ?? item?.Metadata ?? null,
  };
}

function extractTotalCount(payload, itemsLength) {
  const raw =
    payload?.totalCount ??
    payload?.TotalCount ??
    payload?.total ??
    payload?.Total ??
    payload?.count ??
    payload?.Count ??
    itemsLength;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : itemsLength;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    actionType: "",
    adminId: "",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getAdminToken();
      if (!token) {
        setLogs([]);
        setTotalPages(1);
        setError("Sesi admin berakhir. Silakan login ulang.");
        return;
      }
      let url = `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/logs?page=${page}&pageSize=30`;
      if (filter.actionType) url += `&actionType=${filter.actionType}`;
      if (filter.adminId) url += `&adminId=${filter.adminId}`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Gagal memuat audit logs");
      const data = await res.json();
      const payload = unwrapFeatureData(data);
      const logsPayload = payload?.logs ?? payload?.Logs ?? payload;
      const items = extractFeatureItems(logsPayload).map(normalizeAuditLog);
      const totalCount = extractTotalCount(payload, items.length);
      setLogs(items);
      setTotalPages(Math.ceil(totalCount / 30) || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action) => {
    const normalizedAction = String(action || "unknown").toLowerCase();
    const styles = {
      report_action: "border-primary/20 bg-primary/10 text-primary",
      device_ban: "border-destructive/20 bg-destructive/10 text-destructive",
      device_unban: "border-success/20 bg-success/10 text-success",
      warning_issued: "border-warning/20 bg-warning/10 text-warning",
      content_hidden: "border-warning/20 bg-warning/10 text-warning",
      content_unhidden: "border-success/20 bg-success/10 text-success",
      validation_case_move: "border-border bg-accent text-accent-foreground",
      // Legacy (deprecated)
      thread_deleted: "border-destructive/20 bg-destructive/10 text-destructive",
      thread_transferred: "border-border bg-accent text-accent-foreground",
    };

    const labels = {
      report_action: "Report Action",
      device_ban: "Device Ban",
      device_unban: "Device Unban",
      warning_issued: "Warning Issued",
      content_hidden: "Record Hidden",
      content_unhidden: "Record Unhidden",
      validation_case_move: "Validation Case Moved",
      // Legacy (deprecated)
      thread_transferred: "Validation Case Moved (legacy)",
      thread_deleted: "Record Deleted (legacy)",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
          styles[normalizedAction] || "border-border bg-muted/60 text-muted-foreground"
        }`}
      >
        {labels[normalizedAction] || normalizedAction.replace(/_/g, " ")}
      </span>
    );
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID");
  };

  const actionTypes = [
    { value: "", label: "All Actions" },
    { value: "report_action", label: "Report Action" },
    { value: "device_ban", label: "Device Ban" },
    { value: "device_unban", label: "Device Unban" },
    { value: "warning_issued", label: "Warning Issued" },
    { value: "content_hidden", label: "Content Hidden" },
    { value: "content_unhidden", label: "Content Unhidden" },
    { value: "validation_case_move", label: "Validation Case Moved" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Audit Logs</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={filter.actionType}
          onChange={(e) => { setFilter({ ...filter, actionType: e.target.value }); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-background text-foreground"
        >
          {actionTypes.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        
        <input
          type="text"
          placeholder="Filter by Admin ID..."
          value={filter.adminId}
          onChange={(e) => { setFilter({ ...filter, adminId: e.target.value }); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-background text-foreground"
        />
        
        <Button onClick={fetchLogs} variant="secondary">
          Apply Filters
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
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Tidak ada audit logs
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Admin</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Target</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">
                        {log.adminName || `Admin ${log.adminId}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getActionBadge(log.actionType)}
                    </td>
                    <td className="py-3 px-4">
                      {log.targetType && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">{log.targetType}:</span>{" "}
                          <span className="font-mono text-foreground">{log.targetId}</span>
                        </div>
                      )}
                      {log.targetUserId && (
                        <div className="text-xs text-muted-foreground">
                          User ID: {log.targetUserId}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-xs text-muted-foreground truncate">{log.details || log.reason || "-"}</p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-primary cursor-pointer">
                            View metadata
                          </summary>
                          <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-auto max-w-xs">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
