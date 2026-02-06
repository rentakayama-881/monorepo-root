"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";
import { clearAdminSession, getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData } from "@/lib/featureApi";

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
    id:
      item?.id ??
      item?.Id ??
      item?.ID ??
      item?.badge_id ??
      item?.BadgeId ??
      null,
    name: item?.name ?? item?.Name ?? "",
    slug: item?.slug ?? item?.Slug ?? "",
    description: item?.description ?? item?.Description ?? "",
    icon_type:
      item?.icon_type ?? item?.iconType ?? item?.IconType ?? "verified",
    icon_url: item?.icon_url ?? item?.iconUrl ?? item?.IconUrl ?? "",
    color: item?.color ?? item?.Color ?? "#6366f1",
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

  const totalRaw =
    root?.total ?? root?.Total ?? payload?.total ?? payload?.Total ?? null;
  const parsedTotal = Number(totalRaw);
  const total =
    Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : null;

  return { items, total };
}

function extractBadgeItems(payload) {
  const root = unwrapFeatureData(payload);
  const badgesPayload = root?.badges ?? root?.Badges ?? root;
  if (!Array.isArray(badgesPayload)) return [];
  return badgesPayload.map(normalizeBadge).filter((badge) => badge.id != null);
}

export default function AdminUsersPage() {
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

  const getUserBadges = (user) => {
    return Array.isArray(user?.badges) ? user.badges : [];
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm text-destructive">
          {authError}
        </div>
        <p className="text-muted-foreground">Mengalihkan ke halaman login...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="mt-1 text-muted-foreground">Cari user dan kelola badge mereka</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Cari username atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary">
          Cari
        </Button>
      </form>

      {users.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{search ? "User tidak ditemukan" : "Belum ada user"}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => {
            const userBadges = getUserBadges(user);
            return (
              <Card key={user.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username || user.email || "User"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl text-muted-foreground">
                          {(user.username || user.email)?.[0]?.toUpperCase() || "?"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {user.username || "No username"}
                        </span>
                        {user.primary_badge && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor:
                                (user.primary_badge.color || "#6366f1") + "20",
                              color: user.primary_badge.color || "#6366f1",
                            }}
                          >
                            {user.primary_badge.icon_url && (
                              <img
                                src={user.primary_badge.icon_url}
                                alt=""
                                className="w-3 h-3"
                              />
                            )}
                            {user.primary_badge.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>

                      {userBadges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {userBadges.map((badge) => (
                            <span
                              key={badge.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted/50 text-muted-foreground"
                            >
                              {badge.icon_url && (
                                <img
                                  src={badge.icon_url}
                                  alt=""
                                  className="w-3 h-3"
                                />
                              )}
                              {badge.name}
                              <button
                                type="button"
                                onClick={() => handleRevoke(user, badge)}
                                className="ml-1 text-destructive hover:opacity-80"
                                title="Cabut badge"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button variant="secondary" size="sm" onClick={() => openAssignModal(user)}>
                    + Badge
                  </Button>
                </div>
              </Card>
            );
          })}

          {hasMore && (
            <div className="text-center">
              <Button variant="secondary" onClick={loadMore} disabled={loading}>
                Muat Lebih Banyak
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Berikan Badge ke ${selectedUser?.username || selectedUser?.email || "User"}`}
      >
        <form onSubmit={handleAssign} className="space-y-4">
          {assignError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {assignError}
            </div>
          )}

          <Select
            label="Pilih Badge"
            placeholder="-- Pilih Badge --"
            options={badges.map((badge) => ({
              value: String(badge.id),
              label: badge.name,
            }))}
            value={assignData.badge_id}
            onChange={(e) =>
              setAssignData({ ...assignData, badge_id: e.target.value })
            }
            required
          />

          <Input
            label="Alasan (opsional)"
            placeholder="Kontribusi luar biasa..."
            value={assignData.reason}
            onChange={(e) =>
              setAssignData({ ...assignData, reason: e.target.value })
            }
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAssignModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={assigning}>
              {assigning ? "Memberikan..." : "Berikan Badge"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
