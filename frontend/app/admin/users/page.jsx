"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignData, setAssignData] = useState({ badge_id: "", reason: "" });
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const fetchUsers = async (searchQuery = "", pageNum = 1) => {
    const token = localStorage.getItem("admin_token");
    try {
      const params = new URLSearchParams({ limit: "20", page: String(pageNum) });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`${getApiBase()}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (pageNum === 1) {
          setUsers(data.users || []);
        } else {
          setUsers((prev) => [...prev, ...(data.users || [])]);
        }
        setHasMore((data.users || []).length === 20);
      }
    } catch (err) {
      logger.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBadges = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(`${getApiBase()}/admin/badges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch (err) {
      logger.error("Failed to fetch badges:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBadges();
  }, []);

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
    // Refetch badges to ensure we have the latest list
    fetchBadges();
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignData.badge_id) {
      setAssignError("Pilih badge");
      return;
    }

    setAssigning(true);
    setAssignError("");

    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(
        `${getApiBase()}/admin/users/${selectedUser.ID}/badges`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            badge_id: Number(assignData.badge_id),
            reason: assignData.reason,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal memberikan badge");
      }

      setShowAssignModal(false);
      // Refresh users to see updated badges
      fetchUsers(search, 1);
      setPage(1);
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (user, userBadge) => {
    const reason = prompt(`Alasan pencabutan badge "${userBadge.badge.name}"?`);
    if (reason === null) return;

    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(
        `${getApiBase()}/admin/users/${user.ID}/badges/${userBadge.ID}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message || "Gagal mencabut badge");
        return;
      }

      fetchUsers(search, 1);
      setPage(1);
    } catch (err) {
      alert("Gagal mencabut badge");
    }
  };

  const getActiveBadges = (user) => {
    if (!user.badges) return [];
    return user.badges.filter((ub) => !ub.revoked_at);
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(var(--brand))]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Users</h1>
        <p className="mt-1 text-[rgb(var(--muted))]">
          Cari user dan kelola badge mereka
        </p>
      </div>

      {/* Search */}
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

      {/* Users List */}
      {users.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-[rgb(var(--muted))]">
            {search ? "User tidak ditemukan" : "Belum ada user"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => {
            const activeBadges = getActiveBadges(user);
            return (
              <Card key={user.ID} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-[rgb(var(--surface-2))] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl text-[rgb(var(--muted))]">
                          {(user.username || user.email)?.[0]?.toUpperCase() ||
                            "?"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[rgb(var(--fg))] truncate">
                          {user.username || "No username"}
                        </span>
                        {/* Primary badge indicator */}
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
                      <p className="text-sm text-[rgb(var(--muted))] truncate">
                        {user.email}
                      </p>

                      {/* All badges */}
                      {activeBadges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {activeBadges.map((ub) => (
                            <span
                              key={ub.ID}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]"
                            >
                              {ub.badge.icon_url && (
                                <img
                                  src={ub.badge.icon_url}
                                  alt=""
                                  className="w-3 h-3"
                                />
                              )}
                              {ub.badge.name}
                              <button
                                type="button"
                                onClick={() => handleRevoke(user, ub)}
                                className="ml-1 text-red-500 hover:text-red-700"
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

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openAssignModal(user)}
                  >
                    + Badge
                  </Button>
                </div>
              </Card>
            );
          })}

          {hasMore && (
            <div className="text-center">
              <Button variant="secondary" onClick={loadMore}>
                Muat Lebih Banyak
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Assign Badge Modal */}
      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Berikan Badge ke ${selectedUser?.username || "User"}`}
      >
        <form onSubmit={handleAssign} className="space-y-4">
          {assignError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {assignError}
            </div>
          )}

          <Select
            label="Pilih Badge"
            placeholder="-- Pilih Badge --"
            options={badges.map((badge) => ({
              value: String(badge.ID),
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
