"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import logger from "@/lib/logger";
import { getApiBase } from "@/lib/api";

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
  const [iconValid, setIconValid] = useState(true);
  const [iconLoading, setIconLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  // Validate icon URL by loading the image
  const validateIconUrl = (url) => {
    if (!url) {
      setIconValid(true);
      return;
    }
    setIconLoading(true);
    const img = new Image();
    img.onload = () => {
      setIconValid(true);
      setIconLoading(false);
    };
    img.onerror = () => {
      setIconValid(false);
      setIconLoading(false);
    };
    img.src = url;
  };

  const handleIconUrlChange = (url) => {
    setFormData({ ...formData, icon_url: url });
    clearTimeout(window.iconValidateTimeout);
    window.iconValidateTimeout = setTimeout(() => validateIconUrl(url), 500);
  };

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
    setIconValid(true);
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
    setIconValid(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate icon URL before submit
    if (!iconValid) {
      setError("URL gambar tidak valid. Pastikan URL mengarah ke file gambar (.png/.jpg/.webp)");
      return;
    }

    setSaving(true);

    const token = localStorage.getItem("admin_token");
    const isEdit = !!editingBadge;

    try {
      const res = await fetch(
        `${getApiBase()}/admin/badges${isEdit ? `/${editingBadge.ID}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      // Handle empty response safely
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          logger.error("Failed to parse response:", text);
          throw new Error("Response tidak valid dari server");
        }
      }

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "Gagal menyimpan badge");
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
      const res = await fetch(`${getApiBase()}/admin/badges/${badge.ID}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        let data = {};
        if (text) {
          try { data = JSON.parse(text); } catch {}
        }
        alert(data.error?.message || data.error || "Gagal menghapus badge");
        return;
      }

      fetchBadges();
    } catch (err) {
      alert("Gagal menghapus badge: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Badges</h1>
          <p className="mt-1 text-muted-foreground">
            Kelola badge yang dapat diberikan kepada user
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          + Buat Badge
        </Button>
      </div>

      {badges.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Belum ada badge</p>
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
                  <h3 className="font-semibold text-foreground truncate">
                    {badge.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {badge.slug}
                  </p>
                  {badge.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
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
                  className="text-destructive hover:bg-destructive/10"
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
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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

          <div>
            <Input
              label="Icon URL"
              placeholder="https://i.ibb.co/xxxxx/badge.png"
              value={formData.icon_url}
              onChange={(e) => handleIconUrlChange(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Upload gambar ke <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">imgbb.com</a>, lalu copy "Direct link"
            </p>
            {formData.icon_url && !iconValid && !iconLoading && (
              <p className="mt-1 text-xs text-destructive">
                ⚠️ Gambar tidak dapat dimuat. Pastikan URL valid dan dapat diakses.
              </p>
            )}
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Warna
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="h-10 w-20 cursor-pointer rounded border border-border"
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
          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview:</p>
            <div className="flex items-center gap-2">
              {iconLoading ? (
                <div className="w-8 h-8 animate-pulse bg-border rounded"></div>
              ) : formData.icon_url && iconValid ? (
                <img
                  src={formData.icon_url}
                  alt="Preview"
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-border flex items-center justify-center text-xs text-muted-foreground">
                  ?
                </div>
              )}
              <span 
                className="font-medium px-2 py-1 rounded"
                style={{ 
                  backgroundColor: formData.color + "20",
                  color: formData.color 
                }}
              >
                {formData.name || "Badge Name"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={saving || (formData.icon_url && !iconValid)}>
              {saving ? "Menyimpan..." : editingBadge ? "Update" : "Buat"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
