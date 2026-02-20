import { BadgeChip } from "@/components/ui/Badge";
import Select from "@/components/ui/Select";

export default function BadgesSection({ badges, primaryBadgeId, savingBadge, onSavePrimaryBadge }) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Badges</h3>
      <div className="mt-3 space-y-3">
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Badge hanya di dapatkan dari reputasi & kontribusi, baik internal maupun eksternal platform yang mempunyai legitimasi.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <BadgeChip key={badge.id} badge={badge} />
              ))}
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-foreground">Primary Badge (tampil di username)</label>
              <div className="mt-2 flex items-center gap-2">
                <Select
                  value={primaryBadgeId ? String(primaryBadgeId) : ""}
                  onChange={(e) => onSavePrimaryBadge(e.target.value)}
                  disabled={savingBadge}
                  className="flex-1"
                >
                  <option value="">Tidak ada badge ditampilkan</option>
                  {badges.map((badge) => (
                    <option key={badge.id} value={String(badge.id)}>
                      {badge.name}
                    </option>
                  ))}
                </Select>
                {savingBadge && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Badge yang dipilih akan muncul di samping username Anda.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
