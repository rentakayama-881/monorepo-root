"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { getApiBase } from "@/lib/api";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

export default function ThreadManagementPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [userSearch, setUserSearch] = useState({
    query: "",
    results: [],
    loading: false,
    error: "",
  });
  
  // Move form
  const [moveForm, setMoveForm] = useState({
    threadId: "",
    newOwnerId: "",
    newCategoryId: "",
    reason: "",
    dryRun: false,
  });

  // Delete form  
  const [deleteForm, setDeleteForm] = useState({
    threadId: "",
    reason: "",
  });

  const fetchCategories = async () => {
    setCategoryLoading(true);
    setCategoryError("");
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${getApiBase()}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error?.message ||
            "Gagal memuat daftar kategori"
        );
      }

      setCategories(data?.categories || []);
    } catch (e) {
      setCategoryError(e.message);
    } finally {
      setCategoryLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleUserSearch = async () => {
    const q = userSearch.query.trim();
    if (!q) return;

    setUserSearch((s) => ({ ...s, loading: true, error: "", results: [] }));
    try {
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams({ search: q, limit: "10", page: "1" });
      const res = await fetch(`${getApiBase()}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error?.message ||
            "Gagal mencari user"
        );
      }

      setUserSearch((s) => ({ ...s, results: data?.users || [] }));
    } catch (e) {
      setUserSearch((s) => ({ ...s, error: e.message }));
    } finally {
      setUserSearch((s) => ({ ...s, loading: false }));
    }
  };

  const handleMove = async (e) => {
    e.preventDefault();
    if (!confirm("Yakin ingin memindahkan thread ini?")) return;
    
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem("admin_token");
      const threadId = Number(moveForm.threadId);
      const newOwnerId = Number(moveForm.newOwnerId);
      const newCategoryId = moveForm.newCategoryId
        ? Number(moveForm.newCategoryId)
        : null;

      const res = await fetch(`${getApiBase()}/admin/threads/${threadId}/move`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_owner_user_id: newOwnerId,
          new_category_id: newCategoryId,
          reason: moveForm.reason,
          dry_run: moveForm.dryRun,
        }),
      });
      
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error?.message ||
            "Gagal memindahkan thread"
        );
      }
      
      setResult({
        type: "success",
        message: data?.message || "Thread berhasil dipindahkan",
        data: data?.data,
      });
      if (!moveForm.dryRun) {
        setMoveForm({
          threadId: "",
          newOwnerId: "",
          newCategoryId: "",
          reason: "",
          dryRun: false,
        });
        setUserSearch((s) => ({ ...s, results: [] }));
      }
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
        {/* Move Thread */}
        <div className="p-6 rounded-lg border border-border bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>🧭</span> Move Thread
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Pindahkan thread ke owner baru dan/atau kategori baru. Wajib isi reason untuk audit.
          </p>
          
          <form onSubmit={handleMove} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Thread ID *
              </label>
              <input
                type="number"
                value={moveForm.threadId}
                onChange={(e) => setMoveForm({ ...moveForm, threadId: e.target.value })}
                placeholder="cth: 123"
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
                value={moveForm.newOwnerId}
                onChange={(e) => setMoveForm({ ...moveForm, newOwnerId: e.target.value })}
                placeholder="cth: 42"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                required
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userSearch.query}
                  onChange={(e) => setUserSearch((s) => ({ ...s, query: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUserSearch();
                    }
                  }}
                  placeholder="Cari user (email/username)..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
                <Button type="button" variant="secondary" disabled={userSearch.loading} onClick={handleUserSearch}>
                  {userSearch.loading ? "Searching..." : "Search"}
                </Button>
              </div>

              {userSearch.error && (
                <p className="mt-2 text-xs text-red-600">{userSearch.error}</p>
              )}

              {userSearch.results.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-background">
                  {userSearch.results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setMoveForm((f) => ({ ...f, newOwnerId: String(u.id) }));
                        setUserSearch((s) => ({ ...s, results: [] }));
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {u.id}
                      </span>{" "}
                      <span className="text-foreground">
                        {u.username || u.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {u.username && u.email ? ` • ${u.email}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New Category (optional)
              </label>
              <select
                value={moveForm.newCategoryId}
                onChange={(e) => setMoveForm({ ...moveForm, newCategoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                disabled={categoryLoading}
              >
                <option value="">(Tidak mengubah kategori)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.slug})
                  </option>
                ))}
              </select>
              {categoryError && (
                <p className="mt-1 text-xs text-red-600">{categoryError}</p>
              )}
              {!categoryError && categories.length === 0 && !categoryLoading && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Tidak ada kategori atau gagal memuat kategori.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Reason *
              </label>
              <textarea
                value={moveForm.reason}
                onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
                placeholder="Alasan pemindahan (min 5 karakter)..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                rows={2}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={moveForm.dryRun}
                onChange={(e) => setMoveForm({ ...moveForm, dryRun: e.target.checked })}
              />
              Dry run (validasi tanpa commit)
            </label>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Processing..." : (moveForm.dryRun ? "Dry Run Move" : "Move Thread")}
            </Button>

            {result?.type === "success" && result?.data && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div>
                  Thread: <span className="font-mono">{result.data.thread_id}</span>
                </div>
                <div>
                  Owner:{" "}
                  <span className="font-mono">{result.data.old_owner?.id}</span> →{" "}
                  <span className="font-mono">{result.data.new_owner?.id}</span>
                </div>
                <div>
                  Category:{" "}
                  <span className="font-mono">{result.data.old_category?.id}</span> →{" "}
                  <span className="font-mono">{result.data.new_category?.id}</span>
                </div>
                {result.data.request_id && (
                  <div>
                    Request ID: <span className="font-mono">{result.data.request_id}</span>
                  </div>
                )}
              </div>
            )}
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
          <li>• Thread ID ada di URL thread: /thread/<strong>ID_DISINI</strong> (angka)</li>
          <li>• User ID dapat dilihat di halaman Users admin panel</li>
          <li>• Move thread biasanya digunakan saat user request atau akun merger</li>
          <li>• Delete thread hanya untuk konten yang melanggar aturan berat</li>
        </ul>
      </div>
    </div>
  );
}
