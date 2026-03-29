import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";
import { clearAdminSession, getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData } from "@/lib/featureApi";

const BADGE_DEFAULT_COLOR = "#6366f1";

const PAGE_SIZE = 20;

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
    id: item?.id ?? item?.Id ?? item?.ID ?? item?.badge_id ?? item?.BadgeId ?? null,
    name: item?.name ?? item?.Name ?? "",
    slug: item?.slug ?? item?.Slug ?? "",
    description: item?.description ?? item?.Description ?? "",
    icon_type: item?.icon_type ?? item?.iconType ?? item?.IconType ?? "verified",
    icon_url: item?.icon_url ?? item?.iconUrl ?? item?.IconUrl ?? "",
    color: item?.color ?? item?.Color ?? BADGE_DEFAULT_COLOR,
  };
}

function normalizeUser(item) {
  const badges = Array.isArray(item?.badges)
    ? item.badges
    : Array.isArray(item?.Badges)
      ? item.Badges
      : [];

  const primaryBadge = item?.primary_badge ?? item?.PrimaryBadge ?? null;

  return {
    id: item?.id ?? item?.Id ?? item?.ID ?? null,
    email: item?.email ?? item?.Email ?? "",
    username: item?.username ?? item?.Username ?? "",
    avatar_url: item?.avatar_url ?? item?.avatarUrl ?? item?.AvatarURL ?? "",
    primary_badge: primaryBadge ? normalizeBadge(primaryBadge) : null,
    badges: badges.map(normalizeBadge).filter((badge) => badge.id != null),
  };
}

function extractUsersResult(payload) {
  const root = unwrapFeatureData(payload);
  const usersPayload = root?.users ?? root?.Users ?? root;
  const items = Array.isArray(usersPayload) ? usersPayload.map(normalizeUser) : [];

  const totalRaw = root?.total ?? root?.Total ?? payload?.total ?? payload?.Total ?? null;
  const parsedTotal = Number(totalRaw);
  const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : null;

  return { items, total };
}

function extractBadgeItems(payload) {
  const root = unwrapFeatureData(payload);
  const badgesPayload = root?.badges ?? root?.Badges ?? root;
  if (!Array.isArray(badgesPayload)) return [];
  return badgesPayload.map(normalizeBadge).filter((badge) => badge.id != null);
}

export default function useAdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignData, setAssignData] = useState({ badge_id: "", reason: "" });
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const handleAuthExpired = useCallback(() => {
    setAuthError("Sesi admin berakhir. Silakan login kembali.");
    clearAdminSession();
    setTimeout(() => router.push("/admin/login"), 1500);
  }, [router]);

  const fetchUsers = useCallback(
    async (searchQuery = "", pageNum = 1) => {
      const token = getAdminToken();
      if (!token) {
        handleAuthExpired();
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          page: String(pageNum),
        });
        if (searchQuery.trim()) params.set("search", searchQuery.trim());

        const res = await fetch(`${getApiBase()}/admin/users?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await readPayload(res);

        if (res.status === 401 || res.status === 403) {
          handleAuthExpired();
          return;
        }

        if (!res.ok) {
          throw new Error(readErrorMessage(data, "Gagal memuat data user"));
        }

        const { items, total } = extractUsersResult(data);

        if (pageNum === 1) {
          setUsers(items);
        } else {
          setUsers((prev) => [...prev, ...items]);
        }

        if (typeof total === "number") {
          setHasMore(pageNum * PAGE_SIZE < total);
        } else {
          setHasMore(items.length === PAGE_SIZE);
        }
      } catch (err) {
        logger.error("Failed to fetch users:", err);
        if (pageNum === 1) {
          setUsers([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [handleAuthExpired]
  );

  const fetchBadges = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      handleAuthExpired();
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
    }
  }, [handleAuthExpired]);

  useEffect(() => {
    fetchUsers();
    fetchBadges();
  }, [fetchBadges, fetchUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    fetchUsers(search, 1);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchUsers(search, nextPage);
  };

  const openAssignModal = (user) => {
    setSelectedUser(user);
    setAssignData({ badge_id: "", reason: "" });
    setAssignError("");
    setShowAssignModal(true);
    fetchBadges();
  };

  const handleAssign = async (e) => {
    e.preventDefault();

    const userId = Number(selectedUser?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      setAssignError("User tidak valid");
      return;
    }

    const badgeId = Number(assignData.badge_id);
    if (!Number.isFinite(badgeId) || badgeId <= 0) {
      setAssignError("Pilih badge");
      return;
    }

    setAssigning(true);
    setAssignError("");

    const token = getAdminToken();
    if (!token) {
      handleAuthExpired();
      setAssigning(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/admin/users/${userId}/badges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          badge_id: badgeId,
          reason: assignData.reason?.trim() || "",
        }),
      });

      const data = await readPayload(res);

      if (res.status === 401 || res.status === 403) {
        handleAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(readErrorMessage(data, "Gagal memberikan badge"));
      }

      setShowAssignModal(false);
      setPage(1);
      setLoading(true);
      fetchUsers(search, 1);
    } catch (err) {
      setAssignError(err.message || "Gagal memberikan badge");
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (user, badge) => {
    const reason = prompt(`Alasan pencabutan badge "${badge.name}"?`);
    if (reason === null) return;

    const userId = Number(user?.id);
    const badgeId = Number(badge?.id);
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(badgeId) || badgeId <= 0) {
      alert("Data user atau badge tidak valid");
      return;
    }

    const token = getAdminToken();
    if (!token) {
      handleAuthExpired();
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/admin/users/${userId}/badges/${badgeId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await readPayload(res);

      if (res.status === 401 || res.status === 403) {
        handleAuthExpired();
        return;
      }

      if (!res.ok) {
        alert(readErrorMessage(data, "Gagal mencabut badge"));
        return;
      }

      setPage(1);
      setLoading(true);
      fetchUsers(search, 1);
    } catch {
      alert("Gagal mencabut badge");
    }
  };

  return {
    users,
    badges,
    loading,
    authError,
    search,
    setSearch,
    hasMore,
    showAssignModal,
    setShowAssignModal,
    selectedUser,
    assignData,
    setAssignData,
    assigning,
    assignError,
    handleSearch,
    loadMore,
    openAssignModal,
    handleAssign,
    handleRevoke,
  };
}
