import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";
import { clearAdminSession, getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData } from "@/lib/featureApi";
import { BadgePresets } from "@/components/ui/badgeVariants";

const DEFAULT_BADGE_COLOR = BadgePresets.verified.color;

function readErrorMessage(payload, fallback) {
  return (
    payload?.error?.message ||
    payload?.error?.Message ||
    payload?.message ||
    payload?.Message ||
    payload?.error ||
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

function normalizeBadge(item) {
  return {
    id: item?.id ?? item?.Id ?? item?.ID ?? null,
    name: item?.name ?? item?.Name ?? "",
    slug: item?.slug ?? item?.Slug ?? "",
    description: item?.description ?? item?.Description ?? "",
    icon_type: item?.icon_type ?? item?.iconType ?? item?.IconType ?? "verified",
    color: item?.color ?? item?.Color ?? DEFAULT_BADGE_COLOR,
  };
}

function extractBadgeItems(payload) {
  const root = unwrapFeatureData(payload);
  const badgesPayload = root?.badges ?? root?.Badges ?? root;
  if (!Array.isArray(badgesPayload)) return [];
  return badgesPayload.map(normalizeBadge).filter((badge) => badge.id != null);
}

export default function useAdminBadges() {
  const router = useRouter();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon_type: "verified",
    color: DEFAULT_BADGE_COLOR,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAuthExpired = useCallback(() => {
    setAuthError("Sesi admin berakhir. Silakan login kembali.");
    clearAdminSession();
    setTimeout(() => router.push("/admin/login"), 1500);
  }, [router]);

  const fetchBadges = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      handleAuthExpired();
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/admin/badges`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readPayload(res);
      if (res.status === 401 || res.status === 403) {
        handleAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal memuat badge"));
      }

      setBadges(extractBadgeItems(data));
    } catch (err) {
      logger.error("Failed to fetch badges:", err);
    } finally {
      setLoading(false);
    }
  }, [handleAuthExpired]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const openCreateModal = () => {
    setEditingBadge(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon_type: "verified",
      color: DEFAULT_BADGE_COLOR,
    });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      slug: badge.slug,
      description: badge.description || "",
      icon_type: badge.icon_type || "verified",
      color: badge.color || DEFAULT_BADGE_COLOR,
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const token = getAdminToken();
    if (!token) {
      handleAuthExpired();
      setSaving(false);
      return;
    }

    const isEdit = !!editingBadge;
    const name = formData.name.trim();
    const slug = formData.slug.trim();
    const payload = {
      ...formData,
      name,
      slug,
      description: formData.description.trim(),
    };

    if (!name) {
      setError("Nama badge wajib diisi");
      setSaving(false);
      return;
    }
    if (!slug) {
      setError("Slug badge wajib diisi");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(
        `${getApiBase()}/admin/badges${isEdit ? `/${editingBadge.id}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await readPayload(res);

      if (res.status === 401 || res.status === 403) {
        handleAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal menyimpan badge"));
      }

      setShowModal(false);
      setEditingBadge(null);
      fetchBadges();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (badge) => {
    if (!confirm(`Hapus badge "${badge.name}"?`)) return;

    const token = getAdminToken();
    if (!token) {
      handleAuthExpired();
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/admin/badges/${badge.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readPayload(res);

      if (res.status === 401 || res.status === 403) {
        handleAuthExpired();
        return;
      }

      if (!res.ok) {
        alert(readErrorMessage(data, "Gagal menghapus badge"));
        return;
      }

      fetchBadges();
    } catch (err) {
      alert("Gagal menghapus badge: " + err.message);
    }
  };

  return {
    badges,
    loading,
    authError,
    showModal,
    setShowModal,
    editingBadge,
    formData,
    setFormData,
    error,
    saving,
    openCreateModal,
    openEditModal,
    handleSubmit,
    handleDelete,
  };
}
