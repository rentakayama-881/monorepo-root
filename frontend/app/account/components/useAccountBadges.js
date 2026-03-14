import { useCallback, useState } from "react";
import { fetchWithAuth } from "@/lib/tokenRefresh";

export function useAccountBadges({ apiBase, setError, setOk }) {
  const [badges, setBadges] = useState([]);
  const [primaryBadgeId, setPrimaryBadgeId] = useState(null);
  const [savingBadge, setSavingBadge] = useState(false);

  const populate = useCallback((data) => {
    setBadges(data.badges || []);
    setPrimaryBadgeId(data.primary_badge_id || null);
  }, []);

  async function savePrimaryBadge(badgeId) {
    setError("");
    setOk("");
    setSavingBadge(true);

    try {
      const response = await fetchWithAuth(`${apiBase}/account/primary-badge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge_id: badgeId ? Number(badgeId) : null }),
      });

      if (!response.ok) throw new Error("Gagal menyimpan primary badge");

      setPrimaryBadgeId(badgeId ? Number(badgeId) : null);
      setOk(badgeId ? "Display badge berhasil dipasang." : "Display badge berhasil dilepas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBadge(false);
    }
  }

  return {
    badges,
    primaryBadgeId,
    savingBadge,
    savePrimaryBadge,
    populate,
  };
}
