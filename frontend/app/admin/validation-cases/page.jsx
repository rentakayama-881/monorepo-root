"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { getApiBase } from "@/lib/api";
import { getAdminToken } from "@/lib/adminAuth";

function readErrorMessage(payload, fallback) {
  return payload?.details || payload?.error || payload?.message || fallback;
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

function normalizeCategory(item) {
  return {
    id: item?.id ?? item?.ID ?? item?.Id ?? "",
    name: item?.name ?? item?.Name ?? "",
    slug: item?.slug ?? item?.Slug ?? "",
  };
}

function normalizeUser(item) {
  return {
    id: item?.id ?? item?.ID ?? item?.Id ?? "",
    username: item?.username ?? item?.Username ?? "",
    email: item?.email ?? item?.Email ?? "",
  };
}

function normalizeMoveResult(item) {
  return {
    validationCaseId: item?.validation_case_id ?? item?.validationCaseId ?? item?.ValidationCaseID ?? null,
    oldOwnerId: item?.old_owner?.id ?? item?.OldOwner?.ID ?? item?.oldOwner?.id ?? item?.OldOwner?.Id ?? null,
    newOwnerId: item?.new_owner?.id ?? item?.NewOwner?.ID ?? item?.newOwner?.id ?? item?.NewOwner?.Id ?? null,
    oldCategoryId: item?.old_category?.id ?? item?.OldCategory?.ID ?? item?.oldCategory?.id ?? item?.OldCategory?.Id ?? null,
    newCategoryId: item?.new_category?.id ?? item?.NewCategory?.ID ?? item?.newCategory?.id ?? item?.NewCategory?.Id ?? null,
    requestId: item?.request_id ?? item?.requestId ?? item?.RequestID ?? null,
    dryRun: Boolean(item?.dry_run ?? item?.dryRun ?? item?.DryRun),
  };
}

export default function ValidationCaseManagementPage() {
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

  const [moveForm, setMoveForm] = useState({
    validationCaseId: "",
    newOwnerId: "",
    newCategoryId: "",
    reason: "",
    dryRun: false,
  });

  async function fetchCategories() {
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

      const items = Array.isArray(data?.categories) ? data.categories : [];
      setCategories(items.map(normalizeCategory));
    } catch (e) {
      setCategoryError(e.message);
    } finally {
      setCategoryLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  async function handleUserSearch() {
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

      const items = Array.isArray(data?.users) ? data.users : [];
      setUserSearch((s) => ({ ...s, results: items.map(normalizeUser) }));
    } catch (e) {
      setUserSearch((s) => ({ ...s, error: e.message }));
    } finally {
      setUserSearch((s) => ({ ...s, loading: false }));
    }
  }

  async function handleMove(e) {
    e.preventDefault();
    if (!confirm("Yakin ingin memindahkan Validation Case ini?")) return;

    setLoading(true);
    setResult(null);
    try {
      const token = getAdminToken();
      if (!token) {
        throw new Error("Sesi admin berakhir. Silakan login ulang.");
      }

      const validationCaseId = Number(moveForm.validationCaseId);
      const newOwnerId = Number(moveForm.newOwnerId);
      const newCategoryId = moveForm.newCategoryId ? Number(moveForm.newCategoryId) : null;
      const reason = moveForm.reason.trim();

      if (!Number.isFinite(validationCaseId) || validationCaseId <= 0) {
        throw new Error("Validation Case ID tidak valid.");
      }
      if (!Number.isFinite(newOwnerId) || newOwnerId <= 0) {
        throw new Error("New Owner User ID tidak valid.");
      }
      if (newCategoryId != null && (!Number.isFinite(newCategoryId) || newCategoryId <= 0)) {
        throw new Error("New Category tidak valid.");
      }
      if (reason.length < 5) {
        throw new Error("Reason minimal 5 karakter.");
      }

      const res = await fetch(`${getApiBase()}/admin/validation-cases/${validationCaseId}/move`, {
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
        throw new Error(readErrorMessage(data, "Gagal memindahkan Validation Case"));
      }

      setResult({
        type: "success",
        message: data?.message || "Validation Case berhasil dipindahkan",
        data: normalizeMoveResult(data?.data || data),
      });

      if (!moveForm.dryRun) {
        setMoveForm({
          validationCaseId: "",
          newOwnerId: "",
          newCategoryId: "",
          reason: "",
          dryRun: false,
        });
        setUserSearch((s) => ({ ...s, results: [] }));
      }
    } catch (e2) {
      setResult({ type: "error", message: e2.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Validation Case Management</h1>

      {result ? (
        <div
          className={`mb-6 p-3 rounded-lg text-sm ${
            result.type === "success"
              ? "border border-success/30 bg-success/10 text-success"
              : "border border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {result.message}
        </div>
      ) : null}

      <div className="p-6 rounded-lg border border-border bg-card">
        <h2 className="text-lg font-semibold text-foreground mb-2">Move Validation Case</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Transfer ownership dan/atau pindah tipe kasus. Wajib isi reason untuk audit.
        </p>

        <form onSubmit={handleMove} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Validation Case ID *</label>
            <input
              type="number"
              value={moveForm.validationCaseId}
              onChange={(e) => setMoveForm({ ...moveForm, validationCaseId: e.target.value })}
              placeholder="cth: 123"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              required
            />
            <div className="mt-1 text-xs text-muted-foreground">Contoh URL: /validation-cases/123</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">New Owner User ID *</label>
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

            {userSearch.error ? <p className="mt-2 text-xs text-destructive">{userSearch.error}</p> : null}

            {userSearch.results.length > 0 ? (
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
                    <span className="font-mono text-xs text-muted-foreground">{u.id}</span>{" "}
                    <span className="text-foreground">{u.username || u.email}</span>
                    <span className="text-xs text-muted-foreground">{u.username && u.email ? ` • ${u.email}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">New Type (optional)</label>
            <select
              value={moveForm.newCategoryId}
              onChange={(e) => setMoveForm({ ...moveForm, newCategoryId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              disabled={categoryLoading}
            >
              <option value="">(Tidak mengubah tipe)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.slug})
                </option>
              ))}
            </select>
            {categoryError ? <p className="mt-1 text-xs text-destructive">{categoryError}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Reason *</label>
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
            {loading ? "Processing..." : moveForm.dryRun ? "Dry Run Move" : "Move Validation Case"}
          </Button>

          {result?.type === "success" && result?.data ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div>
                Validation Case: <span className="font-mono">{result.data.validationCaseId}</span>
              </div>
              <div>
                Owner: <span className="font-mono">{result.data.oldOwnerId}</span> →{" "}
                <span className="font-mono">{result.data.newOwnerId}</span>
              </div>
              <div>
                Type: <span className="font-mono">{result.data.oldCategoryId}</span> →{" "}
                <span className="font-mono">{result.data.newCategoryId}</span>
              </div>
              {result.data.requestId ? (
                <div>
                  Request ID: <span className="font-mono">{result.data.requestId}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

