"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

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
      const token = localStorage.getItem("admin_token");
      let url = `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/audit-logs?page=${page}&pageSize=30`;
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
      setLogs(data.items || []);
      setTotalPages(Math.ceil((data.totalCount || 0) / 30) || 1);
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
    const styles = {
      report_action: "bg-blue-100 text-blue-800",
      device_ban: "bg-red-100 text-red-800",
      device_unban: "bg-green-100 text-green-800",
      warning_issued: "bg-yellow-100 text-yellow-800",
      content_hidden: "bg-orange-100 text-orange-800",
      content_unhidden: "bg-green-100 text-green-800",
      thread_deleted: "bg-red-100 text-red-800",
      thread_transferred: "bg-purple-100 text-purple-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[action] || "bg-gray-100 text-gray-800"}`}>
        {action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  const actionTypes = [
    { value: "", label: "All Actions" },
    { value: "report_action", label: "Report Action" },
    { value: "device_ban", label: "Device Ban" },
    { value: "device_unban", label: "Device Unban" },
    { value: "warning_issued", label: "Warning Issued" },
    { value: "content_hidden", label: "Content Hidden" },
    { value: "content_unhidden", label: "Content Unhidden" },
    { value: "thread_deleted", label: "Thread Deleted" },
    { value: "thread_transferred", label: "Thread Transferred" },
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
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
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
                      {new Date(log.createdAt).toLocaleString("id-ID")}
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
