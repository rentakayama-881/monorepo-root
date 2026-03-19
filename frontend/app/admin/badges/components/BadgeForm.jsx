import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { BadgeIconPreview } from "./BadgeList";

const ICON_TYPES = [
  { value: "verified", label: "Terverifikasi", description: "Centang biru untuk badge verifikasi" },
  { value: "admin", label: "Admin", description: "Ikon perisai untuk admin" },
  { value: "moderator", label: "Moderator", description: "Ikon bintang untuk moderator" },
  { value: "contributor", label: "Kontributor", description: "Ikon kode untuk kontributor" },
  { value: "premium", label: "Premium", description: "Ikon mahkota untuk member premium" },
  {
    value: "trusted",
    label: "Tepercaya",
    description: "Perisai dan centang untuk pengguna tepercaya",
  },
  { value: "checkmark", label: "Centang", description: "Badge dengan ikon centang" },
];

export default function BadgeForm({
  showModal,
  onClose,
  editingBadge,
  formData,
  setFormData,
  error,
  saving,
  onSubmit,
}) {
  return (
    <Modal
      open={showModal}
      onClose={onClose}
      title={editingBadge ? "Ubah Badge" : "Buat Badge Baru"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Input
          label="Nama Badge"
          placeholder="Penjual Terverifikasi"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <Input
          label="Slug"
          placeholder="verified-seller"
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          required
        />

        <Textarea
          label="Deskripsi"
          placeholder="Penghargaan untuk..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />

        {/* Icon Type Selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Tipe Icon</label>
          <div className="grid grid-cols-2 gap-2">
            {ICON_TYPES.map((iconType) => (
              <button
                key={iconType.value}
                type="button"
                onClick={() => setFormData({ ...formData, icon_type: iconType.value })}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                  formData.icon_type === iconType.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <BadgeIconPreview type={iconType.value} color={formData.color} size="h-5 w-5" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{iconType.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{iconType.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Warna</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded border border-border"
            />
            <Input
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-md bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Pratinjau:</p>
          <div className="flex items-center gap-3">
            {/* Icon only (next to username) */}
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">@username</span>
              <BadgeIconPreview type={formData.icon_type} color={formData.color} size="h-4 w-4" />
            </div>

            {/* Chip style */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium"
              style={{
                backgroundColor: formData.color + "15",
                color: formData.color,
              }}
            >
              <BadgeIconPreview
                type={formData.icon_type}
                color={formData.color}
                size="h-3.5 w-3.5"
              />
              {formData.name || "Nama Badge"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Menyimpan..." : editingBadge ? "Simpan Perubahan" : "Buat"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
