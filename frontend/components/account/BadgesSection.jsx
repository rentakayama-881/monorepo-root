import { useState } from "react";
import { BadgeChip } from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

export default function BadgesSection({ badges, primaryBadgeId, savingBadge, onSavePrimaryBadge }) {
  const [selectedBadgeId, setSelectedBadgeId] = useState(null);
  const hasChanges = selectedBadgeId !== null;
  const currentValue = hasChanges ? selectedBadgeId : primaryBadgeId ? String(primaryBadgeId) : "";

  async function handleConfirm() {
    if (selectedBadgeId === null) return;
    await onSavePrimaryBadge(selectedBadgeId);
    setSelectedBadgeId(null);
  }

  function handleCancel() {
    setSelectedBadgeId(null);
  }

  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Badge</h3>
      <div className="mt-3 space-y-3">
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Badge hanya di dapatkan dari reputasi & kontribusi, baik internal maupun eksternal
            platform yang mempunyai legitimasi.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <BadgeChip key={badge.id} badge={badge} />
              ))}
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-foreground">Badge Tampilan</label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pilih badge yang ingin ditampilkan di samping username Anda.
              </p>
              <div className="mt-2">
                <Select
                  value={currentValue}
                  onChange={(e) => setSelectedBadgeId(e.target.value)}
                  disabled={savingBadge}
                  className="w-full"
                >
                  <option value="">Tidak ada badge ditampilkan</option>
                  {badges.map((badge) => (
                    <option key={badge.id} value={String(badge.id)}>
                      {badge.name}
                    </option>
                  ))}
                </Select>
              </div>
              {hasChanges && (
                <div className="mt-3 flex items-center gap-2">
                  <Button type="button" size="sm" onClick={handleConfirm} disabled={savingBadge}>
                    {savingBadge ? "Menyimpan..." : "Simpan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={savingBadge}
                  >
                    Batal
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
