"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function ThreadManagementPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Transfer form
  const [transferForm, setTransferForm] = useState({
    threadId: "",
    newOwnerId: "",
    reason: "",
  });

  // Delete form  
  const [deleteForm, setDeleteForm] = useState({
    threadId: "",
    reason: "",
  });

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!confirm("Yakin ingin transfer kepemilikan thread ini?")) return;
    
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/threads/transfer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId: parseInt(transferForm.threadId),
            newOwnerUserId: parseInt(transferForm.newOwnerId),
            reason: transferForm.reason,
          }),
        }
      );
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal transfer thread");
      }
      
      setResult({ type: "success", message: "Thread berhasil ditransfer" });
      setTransferForm({ threadId: "", newOwnerId: "", reason: "" });
    } catch (e) {
      setResult({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!confirm("PERINGATAN: Thread akan dihapus permanen. Yakin?")) return;
    
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/threads/${deleteForm.threadId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: deleteForm.reason,
          }),
        }
      );
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal menghapus thread");
      }
      
      setResult({ type: "success", message: "Thread berhasil dihapus" });
      setDeleteForm({ threadId: "", reason: "" });
    } catch (e) {
      setResult({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Thread Management</h1>

      {result && (
        <div className={`mb-6 p-3 rounded-lg text-sm ${
          result.type === "success" 
            ? "bg-green-50 text-green-700" 
            : "bg-red-50 text-red-700"
        }`}>
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Ownership */}
        <div className="p-6 rounded-lg border border-border bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>🔄</span> Transfer Ownership
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Transfer kepemilikan thread ke user lain. Thread akan berpindah ke user baru.
          </p>
          
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Thread ID *
              </label>
              <input
                type="text"
                value={transferForm.threadId}
                onChange={(e) => setTransferForm({ ...transferForm, threadId: e.target.value })}
                placeholder="cth: abc123"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New Owner User ID *
              </label>
              <input
                type="number"
                value={transferForm.newOwnerId}
                onChange={(e) => setTransferForm({ ...transferForm, newOwnerId: e.target.value })}
                placeholder="cth: 42"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Reason *
              </label>
              <textarea
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                placeholder="Alasan transfer..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                rows={2}
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Processing..." : "Transfer Thread"}
            </Button>
          </form>
        </div>

        {/* Delete Thread */}
        <div className="p-6 rounded-lg border border-red-200 bg-red-50/30">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>🗑️</span> Delete Thread
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            <strong className="text-red-600">PERINGATAN:</strong> Menghapus thread secara permanen. 
            Semua balasan dan reaksi juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
          </p>
          
          <form onSubmit={handleDelete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Thread ID *
              </label>
              <input
                type="text"
                value={deleteForm.threadId}
                onChange={(e) => setDeleteForm({ ...deleteForm, threadId: e.target.value })}
                placeholder="cth: abc123"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Reason *
              </label>
              <textarea
                value={deleteForm.reason}
                onChange={(e) => setDeleteForm({ ...deleteForm, reason: e.target.value })}
                placeholder="Alasan penghapusan..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                rows={2}
                required
              />
            </div>

            <Button type="submit" variant="danger" disabled={loading} className="w-full">
              {loading ? "Processing..." : "Delete Thread Permanently"}
            </Button>
          </form>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 p-4 rounded-lg bg-muted/50">
        <h3 className="text-sm font-medium text-foreground mb-2">ℹ️ Panduan</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Thread ID dapat dilihat di URL thread: /thread/<strong>ID_DISINI</strong></li>
          <li>• User ID dapat dilihat di halaman Users admin panel</li>
          <li>• Transfer ownership biasanya digunakan saat user request atau akun merger</li>
          <li>• Delete thread hanya untuk konten yang melanggar aturan berat</li>
        </ul>
      </div>
    </div>
  );
}
