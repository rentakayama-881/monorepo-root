import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import {
  normalizeAccountPayload,
  normalizeTelegramAuth,
  generateIdempotencyKey,
} from "./accountUtils";

export function useAccountPage() {
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");
  const focus = searchParams.get("focus");
  const apiBase = `${getApiBase()}/api`;

  const authed = useMemo(() => {
    try {
      return !!getToken();
    } catch {
      return false;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [me, setMe] = useState(null);
  const [username, setUsername] = useState("");
  const [form, setForm] = useState({ full_name: "", bio: "", pronouns: "", company: "" });
  const [socials, setSocials] = useState([{ label: "", url: "" }]);
  const [telegramAuth, setTelegramAuth] = useState(() =>
    normalizeTelegramAuth({ connected: false })
  );

  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  const [badges, setBadges] = useState([]);
  const [primaryBadgeId, setPrimaryBadgeId] = useState(null);
  const [savingBadge, setSavingBadge] = useState(false);

  const featureBase = useMemo(
    () => process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id",
    []
  );
  const [walletBalance, setWalletBalance] = useState(null);
  const [guaranteeAmount, setGuaranteeAmount] = useState(0);
  const [guaranteeLoading, setGuaranteeLoading] = useState(false);
  const [setGuaranteeAmountInput, setSetGuaranteeAmountInput] = useState("");
  const [setGuaranteePin, setSetGuaranteePin] = useState("");
  const [releaseGuaranteePin, setReleaseGuaranteePin] = useState("");
  const [guaranteeSubmitting, setGuaranteeSubmitting] = useState(false);
  const [guaranteeReleasing, setGuaranteeReleasing] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [savedProfileSignature, setSavedProfileSignature] = useState(
    JSON.stringify(normalizeAccountPayload({}, []))
  );
  const passkeySectionRef = useRef(null);
  const [highlightPasskeySection, setHighlightPasskeySection] = useState(false);

  const profilePayload = useMemo(() => normalizeAccountPayload(form, socials), [form, socials]);
  const profilePayloadSignature = useMemo(() => JSON.stringify(profilePayload), [profilePayload]);
  const profileDirty = profilePayloadSignature !== savedProfileSignature;

  useEffect(() => {
    if (profileDirty) {
      setProfileSaveMessage("");
    }
  }, [profileDirty]);

  useEffect(() => {
    if (!authed) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setGuaranteeLoading(true);

    const loadAll = async () => {
      const [accountResult, badgesResult, walletResult, guaranteeResult] = await Promise.allSettled(
        [
          fetchWithAuth(`${apiBase}/account/me`).then(async (r) => {
            if (!r.ok) throw new Error("Gagal memuat akun");
            return r.json();
          }),
          fetchWithAuth(`${apiBase}/account/badges`).then(async (r) => {
            if (!r.ok) return null;
            return r.json();
          }),
          fetchWithAuth(`${featureBase}/api/v1/wallets/me`).then(async (r) => {
            if (!r.ok) return null;
            return r.json();
          }),
          fetchWithAuth(`${featureBase}/api/v1/guarantees/me`).then(async (r) => {
            if (!r.ok) return null;
            return r.json();
          }),
        ]
      );

      if (cancelled) return;

      // Account (critical — show error if fails)
      if (accountResult.status === "fulfilled") {
        const data = accountResult.value;
        setMe(data);
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");

        const nextForm = {
          full_name: data.full_name || "",
          bio: data.bio || "",
          pronouns: data.pronouns || "",
          company: data.company || "",
        };

        const socialAccounts = Array.isArray(data.social_accounts) ? data.social_accounts : [];
        const normalized = normalizeAccountPayload(nextForm, socialAccounts);

        setForm(nextForm);
        setSocials(
          normalized.social_accounts.length ? normalized.social_accounts : [{ label: "", url: "" }]
        );
        setTelegramAuth(normalizeTelegramAuth(data.telegram_auth));
        setSavedProfileSignature(JSON.stringify(normalized));
        setProfileSaveMessage("");
      } else {
        setError(
          accountResult.reason instanceof Error
            ? accountResult.reason.message
            : String(accountResult.reason)
        );
      }

      // Badges (non-critical — silently ignore errors)
      if (badgesResult.status === "fulfilled" && badgesResult.value) {
        setBadges(badgesResult.value.badges || []);
        setPrimaryBadgeId(badgesResult.value.primary_badge_id || null);
      }

      // Wallet (non-critical)
      if (walletResult.status === "fulfilled" && walletResult.value) {
        const wallet = walletResult.value;
        setWalletBalance(typeof wallet?.balance === "number" ? wallet.balance : 0);
      }

      // Guarantee (non-critical)
      if (guaranteeResult.status === "fulfilled" && guaranteeResult.value) {
        const guarantee = guaranteeResult.value;
        setGuaranteeAmount(typeof guarantee?.amount === "number" ? guarantee.amount : 0);
      }

      setLoading(false);
      setGuaranteeLoading(false);
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [apiBase, featureBase, authed]);

  async function loadWalletAndGuarantee() {
    if (!authed) return;

    setGuaranteeLoading(true);
    try {
      const [walletResult, guaranteeResult] = await Promise.allSettled([
        fetchWithAuth(`${featureBase}/api/v1/wallets/me`).then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        }),
        fetchWithAuth(`${featureBase}/api/v1/guarantees/me`).then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        }),
      ]);

      if (walletResult.status === "fulfilled" && walletResult.value) {
        setWalletBalance(
          typeof walletResult.value?.balance === "number" ? walletResult.value.balance : 0
        );
      }
      if (guaranteeResult.status === "fulfilled" && guaranteeResult.value) {
        setGuaranteeAmount(
          typeof guaranteeResult.value?.amount === "number" ? guaranteeResult.value.amount : 0
        );
      }
    } catch {
      // Ignore feature-service errors on account page.
    } finally {
      setGuaranteeLoading(false);
    }
  }

  useEffect(() => {
    if (focus !== "passkeys" || loading) return;
    if (!passkeySectionRef.current) return;

    passkeySectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setHighlightPasskeySection(true);

    const timeoutId = window.setTimeout(() => {
      setHighlightPasskeySection(false);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [focus, loading]);

  async function submitSetGuarantee(event) {
    event.preventDefault();
    setError("");
    setOk("");
    setGuaranteeSubmitting(true);

    try {
      const amount = Number(setGuaranteeAmountInput);
      if (!Number.isFinite(amount)) throw new Error("Jumlah jaminan tidak valid");
      if (amount < 100000) throw new Error("Minimal jaminan adalah Rp 100.000");
      if (walletBalance != null && amount > walletBalance) throw new Error("Saldo tidak mencukupi");
      if (!setGuaranteePin || String(setGuaranteePin).length !== 6)
        throw new Error("PIN harus 6 digit");

      const response = await fetchWithAuth(`${featureBase}/api/v1/guarantees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount, pin: setGuaranteePin }),
      });

      const rawText = await response.text();
      if (!response.ok) {
        let message = rawText;
        try {
          const parsed = JSON.parse(rawText);
          message = parsed?.error?.message || parsed?.message || parsed?.error || rawText;
        } catch {
          // Keep raw text.
        }
        throw new Error(message || "Gagal mengunci jaminan");
      }

      let payload = {};
      try {
        payload = JSON.parse(rawText);
      } catch {
        // Keep fallback amount.
      }

      setGuaranteeAmount(typeof payload?.amount === "number" ? payload.amount : amount);
      setOk("Jaminan berhasil dikunci.");
      setSetGuaranteeAmountInput("");
      setSetGuaranteePin("");
      await loadWalletAndGuarantee();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuaranteeSubmitting(false);
    }
  }

  async function submitReleaseGuarantee(event) {
    event.preventDefault();
    setError("");
    setOk("");
    setGuaranteeReleasing(true);

    try {
      if (!releaseGuaranteePin || String(releaseGuaranteePin).length !== 6) {
        throw new Error("PIN harus 6 digit");
      }

      const response = await fetchWithAuth(`${featureBase}/api/v1/guarantees/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ pin: releaseGuaranteePin }),
      });

      const rawText = await response.text();
      if (!response.ok) {
        let message = rawText;
        try {
          const parsed = JSON.parse(rawText);
          message = parsed?.error?.message || parsed?.message || parsed?.error || rawText;
        } catch {
          // Keep raw text.
        }
        throw new Error(message || "Gagal melepaskan jaminan");
      }

      setGuaranteeAmount(0);
      setOk("Jaminan berhasil dilepaskan.");
      setReleaseGuaranteePin("");
      await loadWalletAndGuarantee();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuaranteeReleasing(false);
    }
  }

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

  const updateSocial = useCallback((index, key, value) => {
    setSocials((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }, []);

  const addSocial = useCallback(() => {
    setSocials((prev) => [...prev, { label: "", url: "" }]);
  }, []);

  const removeSocial = useCallback((index) => {
    setSocials((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const onAvatarFileChange = useCallback((event) => {
    setOk("");
    setError("");

    const file = event.target.files && event.target.files[0];
    if (file) {
      const extension = file.name.toLowerCase().split(".").pop() || "";
      if (!["jpg", "jpeg", "png"].includes(extension)) {
        setError("Format gambar harus JPG atau PNG");
        event.target.value = "";
        return;
      }
    }

    setAvatarFile(file || null);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarPreview("");
    }
  }, []);

  const cancelAvatarPreview = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview("");
  }, []);

  async function uploadAvatar() {
    setError("");
    setOk("");
    setAvatarUploading(true);

    try {
      if (!avatarFile) throw new Error("Pilih file gambar terlebih dahulu");

      const formData = new FormData();
      formData.append("file", avatarFile);

      const response = await fetchWithAuth(`${apiBase}/account/avatar`, {
        method: "PUT",
        body: formData,
      });

      const rawText = await response.text();
      if (!response.ok) throw new Error(rawText || "Gagal mengunggah avatar");

      let parsed = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Keep fallback URL.
      }

      const nextUrl = parsed.avatar_url || avatarUrl || "";
      if (nextUrl) setAvatarUrl(nextUrl);
      setOk("Foto profil diperbarui.");
      cancelAvatarPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function deleteAvatar() {
    setError("");
    setOk("");
    setAvatarDeleting(true);

    try {
      const response = await fetchWithAuth(`${apiBase}/account/avatar`, { method: "DELETE" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Gagal menghapus foto profil");
      }

      setAvatarUrl("");
      setOk("Foto profil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarDeleting(false);
    }
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (!profileDirty || profileSaving) return;

    setError("");
    setOk("");
    setProfileSaveMessage("");
    setProfileSaving(true);

    try {
      const response = await fetchWithAuth(`${apiBase}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Gagal menyimpan akun");
      }

      setSavedProfileSignature(profilePayloadSignature);
      setProfileSaveMessage("Perubahan profil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileSaving(false);
    }
  }

  return {
    // Search params
    setup2fa,

    // Auth
    authed,

    // Loading / messages
    loading,
    error,
    ok,

    // Profile data
    me,
    username,
    form,
    setForm,
    socials,
    telegramAuth,
    setTelegramAuth,

    // Avatar
    avatarUrl,
    avatarFile,
    avatarPreview,
    avatarUploading,
    avatarDeleting,
    onAvatarFileChange,
    onCancelAvatarPreview: cancelAvatarPreview,
    onUploadAvatar: uploadAvatar,
    onDeleteAvatar: deleteAvatar,

    // Badges
    badges,
    primaryBadgeId,
    savingBadge,
    onSavePrimaryBadge: savePrimaryBadge,

    // Profile save
    profileDirty,
    profileSaving,
    profileSaveMessage,
    onSaveAccount: saveAccount,

    // Socials
    updateSocial,
    addSocial,
    removeSocial,

    // Guarantee
    guaranteeAmount,
    guaranteeLoading,
    walletBalance,
    releaseGuaranteePin,
    setReleaseGuaranteePin,
    setGuaranteeAmountInput,
    setSetGuaranteeAmountInput,
    setGuaranteePin,
    setSetGuaranteePin,
    guaranteeReleasing,
    guaranteeSubmitting,
    onSubmitSetGuarantee: submitSetGuarantee,
    onSubmitReleaseGuarantee: submitReleaseGuarantee,

    // Passkey highlight
    passkeySectionRef,
    highlightPasskeySection,

    // API base (needed by DeleteAccountSection)
    apiBase,
  };
}
