"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon_url: "",
    color: "#6366f1",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchBadges = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(`${API_URL}/admin/badges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch (err) {
      console.error("Failed to fetch badges:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  const openCreateModal = () => {
    setEditingBadge(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon_url: "",
      color: "#6366f1",
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
      icon_url: badge.icon_url,
      color: badge.color || "#6366f1",
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const token = localStorage.getItem("admin_token");
    const isEdit = !!editingBadge;

    try {
      const res = await fetch(
        `${API_URL}/admin/badges${isEdit ? `/${editingBadge.ID}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal menyimpan badge");
      }

      setShowModal(false);
      fetchBadges();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (badge) => {
    if (!confirm(`Hapus badge "${badge.name}"?`)) return;

    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(`${API_URL}/admin/badges/${badge.ID}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message || "Gagal menghapus badge");
        return;
      }

      fetchBadges();
    } catch (err) {
      alert("Gagal menghapus badge");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(var(--brand))]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Badges</h1>
          <p className="mt-1 text-[rgb(var(--muted))]">
            Kelola badge yang dapat diberikan kepada user
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          + Buat Badge
        </Button>
      </div>

      {badges.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-[rgb(var(--muted))]">Belum ada badge</p>
          <Button variant="primary" onClick={openCreateModal} className="mt-4">
            Buat Badge Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <Card key={badge.ID} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: badge.color + "20" }}
                >
                  {badge.icon_url ? (
                    <img
                      src={badge.icon_url}
                      alt={badge.name}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    "🏆"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[rgb(var(--fg))] truncate">
                    {badge.name}
                  </h3>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    {badge.slug}
                  </p>
                  {badge.description && (
                    <p className="mt-1 text-sm text-[rgb(var(--muted))] line-clamp-2">
                      {badge.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(badge)}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDelete(badge)}
                  className="text-red-600 hover:bg-red-50"
                >
                  Hapus
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingBadge ? "Edit Badge" : "Buat Badge Baru"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Input
            label="Nama Badge"
            placeholder="Verified Seller"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />

          <Input
            label="Slug"
            placeholder="verified-seller"
            value={formData.slug}
            onChange={(e) =>
              setFormData({ ...formData, slug: e.target.value })
            }
            required
          />

          <Textarea
            label="Deskripsi"
            placeholder="Penghargaan untuk..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
          />

          <Input
            label="Icon URL"
            placeholder="https://example.com/badge.png"
            value={formData.icon_url}
            onChange={(e) =>
              setFormData({ ...formData, icon_url: e.target.value })
            }
            required
          />

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-[rgb(var(--fg))]">
              Warna
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="h-10 w-20 cursor-pointer rounded border border-[rgb(var(--border))]"
              />
              <Input
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="flex-1"
              />
            </div>
          </div>

          {/* Preview */}
          {formData.icon_url && (
            <div className="rounded-md bg-[rgb(var(--surface-2))] p-4">
              <p className="text-xs text-[rgb(var(--muted))] mb-2">Preview:</p>
              <div className="flex items-center gap-2">
                <img
                  src={formData.icon_url}
                  alt="Preview"
                  className="w-6 h-6 object-contain"
                  onError={(e) => (e.target.style.display = "none")}
                />
                <span className="font-medium">{formData.name || "Badge"}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Menyimpan..." : editingBadge ? "Update" : "Buat"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
