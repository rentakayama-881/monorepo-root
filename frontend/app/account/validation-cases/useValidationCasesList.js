import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";

function formatDeleteCaseError(err, fallback = "Gagal menghapus Validation Case") {
  const message = String(err?.message || fallback).trim();
  const details = String(err?.details || "").trim();
  if (!details) return message || fallback;
  const generic = new Set([
    "input tidak valid",
    "kesalahan database",
    "terjadi kesalahan internal",
  ]);
  if (generic.has(message.toLowerCase())) {
    return details;
  }
  return `${message}: ${details}`;
}

export default function useValidationCasesList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await fetchJsonAuth("/api/validation-cases/me", { method: "GET" });
      setItems(Array.isArray(data?.validation_cases) ? data.validation_cases : []);
    } catch (e) {
      setError(e?.message || "Gagal memuat My Validation Cases");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    load();
    // Mount-only: auth check + initial data load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDeleteDialog(validationCase) {
    const id = validationCase?.id;
    if (!id) return;
    setDeleteTarget({
      id: String(id),
      title: String(validationCase?.title || "(untitled)"),
    });
  }

  async function confirmDeleteCase() {
    const targetId = String(deleteTarget?.id || "");
    if (!targetId) return;

    setDeletingId(targetId);
    setError("");
    try {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(formatDeleteCaseError(e));
    } finally {
      setDeletingId(null);
    }
  }

  return {
    loading,
    error,
    items,
    deletingId,
    deleteTarget,
    setDeleteTarget,
    openDeleteDialog,
    confirmDeleteCase,
  };
}
