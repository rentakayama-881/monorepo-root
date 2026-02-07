"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { getApiBase } from "@/lib/api";
import { getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData } from "@/lib/featureApi";

const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "";

function normalizeCategory(item) {
  return {
    id: item?.id ?? item?.Id ?? item?.ID ?? "",
    name: item?.name ?? item?.Name ?? "",
    slug: item?.slug ?? item?.Slug ?? "",
  };
}

function normalizeUser(item) {
  return {
    id: item?.id ?? item?.Id ?? item?.ID ?? "",
    username: item?.username ?? item?.Username ?? "",
    email: item?.email ?? item?.Email ?? "",
  };
}

function normalizeMoveResult(item) {
  return {
    threadId: item?.threadId ?? item?.ThreadId ?? item?.thread_id ?? null,
    oldOwnerId:
      item?.oldOwner?.id ??
      item?.OldOwner?.ID ??
      item?.old_owner?.id ??
      null,
    newOwnerId:
      item?.newOwner?.id ??
      item?.NewOwner?.ID ??
      item?.new_owner?.id ??
      null,
    oldCategoryId:
      item?.oldCategory?.id ??
      item?.OldCategory?.ID ??
      item?.old_category?.id ??
      null,
    newCategoryId:
      item?.newCategory?.id ??
      item?.NewCategory?.ID ??
      item?.new_category?.id ??
      null,
    requestId: item?.requestId ?? item?.RequestID ?? item?.request_id ?? null,
  };
}

function readErrorMessage(payload, fallback) {
  return (
    payload?.error?.message ||
    payload?.error?.Message ||
    payload?.message ||
    payload?.Message ||
    fallback
  );
}

async function readPayload(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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
      const token = getAdminToken();
      if (!token) {
        setCategories([]);
        setCategoryError("Sesi admin berakhir. Silakan login ulang.");
        return;
      }

      const res = await fetch(`${getApiBase()}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readPayload(res);
      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal memuat daftar kategori"));
      }

      const payload = unwrapFeatureData(data);
      const categoriesPayload = payload?.categories ?? payload?.Categories ?? payload;
      const items = Array.isArray(categoriesPayload) ? categoriesPayload : [];
      setCategories(items.map(normalizeCategory));
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
      const token = getAdminToken();
      if (!token) {
        throw new Error("Sesi admin berakhir. Silakan login ulang.");
      }

      const params = new URLSearchParams({ search: q, limit: "10", page: "1" });
      const res = await fetch(`${getApiBase()}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readPayload(res);
      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal mencari user"));
      }

      const payload = unwrapFeatureData(data);
      const usersPayload = payload?.users ?? payload?.Users ?? payload;
      const items = Array.isArray(usersPayload) ? usersPayload : [];
      setUserSearch((s) => ({ ...s, results: items.map(normalizeUser) }));
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
      const token = getAdminToken();
      if (!token) {
        throw new Error("Sesi admin berakhir. Silakan login ulang.");
      }

      const threadId = Number(moveForm.threadId);
      const newOwnerId = Number(moveForm.newOwnerId);
      const newCategoryId = moveForm.newCategoryId
        ? Number(moveForm.newCategoryId)
        : null;
      const reason = moveForm.reason.trim();

      if (!Number.isFinite(threadId) || threadId <= 0) {
        throw new Error("Thread ID tidak valid.");
      }
      if (!Number.isFinite(newOwnerId) || newOwnerId <= 0) {
        throw new Error("New Owner User ID tidak valid.");
      }
      if (
        newCategoryId != null &&
        (!Number.isFinite(newCategoryId) || newCategoryId <= 0)
      ) {
        throw new Error("New Category tidak valid.");
      }
      if (reason.length < 5) {
        throw new Error("Reason minimal 5 karakter.");
      }

      const res = await fetch(`${getApiBase()}/admin/threads/${threadId}/move`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_owner_user_id: newOwnerId,
          new_category_id: newCategoryId,
          reason,
          dry_run: moveForm.dryRun,
        }),
      });
      
      const data = await readPayload(res);
      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal memindahkan thread"));
      }

      const moveResultPayload = unwrapFeatureData(data);
      
      setResult({
        type: "success",
        message: data?.message || "Thread berhasil dipindahkan",
        data: normalizeMoveResult(moveResultPayload),
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
      const token = getAdminToken();
      if (!token) {
        throw new Error("Sesi admin berakhir. Silakan login ulang.");
      }
      if (!FEATURE_SERVICE_URL) {
        throw new Error("Feature service URL belum dikonfigurasi.");
      }

      const threadId = Number(deleteForm.threadId);
      if (!Number.isFinite(threadId) || threadId <= 0) {
        throw new Error("Thread ID harus berupa angka positif.");
      }

      const reason = deleteForm.reason.trim();
      if (reason.length < 3) {
        throw new Error("Reason minimal 3 karakter.");
      }

      const params = new URLSearchParams({
        hardDelete: "true",
        reason,
      });
      const res = await fetch(
        `${FEATURE_SERVICE_URL}/api/v1/admin/moderation/threads/${threadId}?${params.toString()}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          }
        }
      );

      const data = await readPayload(res);
      
      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal menghapus thread"));
      }
      
      setResult({
        type: "success",
        message: data?.message || "Thread berhasil dihapus",
      });
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
            ? "border border-success/30 bg-success/10 text-success"
            : "border border-destructive/30 bg-destructive/10 text-destructive"
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
                <p className="mt-2 text-xs text-destructive">{userSearch.error}</p>
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
                <p className="mt-1 text-xs text-destructive">{categoryError}</p>
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
                  Thread: <span className="font-mono">{result.data.threadId}</span>
                </div>
                <div>
                  Owner:{" "}
                  <span className="font-mono">{result.data.oldOwnerId}</span> →{" "}
                  <span className="font-mono">{result.data.newOwnerId}</span>
                </div>
                <div>
                  Category:{" "}
                  <span className="font-mono">{result.data.oldCategoryId}</span> →{" "}
                  <span className="font-mono">{result.data.newCategoryId}</span>
                </div>
                {result.data.requestId && (
                  <div>
                    Request ID: <span className="font-mono">{result.data.requestId}</span>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Delete Thread */}
        <div className="p-6 rounded-lg border border-destructive/30 bg-destructive/5">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>🗑️</span> Delete Thread
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            <strong className="text-destructive">PERINGATAN:</strong> Menghapus thread secara permanen. 
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
                placeholder="cth: 123"
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
