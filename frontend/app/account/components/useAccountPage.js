import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { useAccountProfile } from "./useAccountProfile";
import { useAccountAvatar } from "./useAccountAvatar";
import { useAccountBadges } from "./useAccountBadges";
import { useAccountGuarantee } from "./useAccountGuarantee";

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

  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [me, setMe] = useState(null);

  const featureBase = useMemo(
    () => process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.aivalid.id",
    []
  );

  const passkeySectionRef = useRef(null);
  const [highlightPasskeySection, setHighlightPasskeySection] = useState(false);

  const profile = useAccountProfile({ apiBase, setError, setOk });
  const avatar = useAccountAvatar({ apiBase, setError, setOk });
  const badgesHook = useAccountBadges({ apiBase, setError, setOk });
  const guarantee = useAccountGuarantee({ featureBase, authed, setError, setOk });

  // Destructure stable callbacks for useEffect dependency tracking
  const { populate: populateProfile } = profile;
  const { populate: populateAvatar } = avatar;
  const { populate: populateBadges } = badgesHook;
  const { populate: populateGuarantee } = guarantee;

  useEffect(() => {
    if (!authed) return;

    let cancelled = false;

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
        populateProfile(data);
        populateAvatar(data);
      } else {
        setError(
          accountResult.reason instanceof Error
            ? accountResult.reason.message
            : String(accountResult.reason)
        );
      }

      // Badges (non-critical — silently ignore errors)
      if (badgesResult.status === "fulfilled" && badgesResult.value) {
        populateBadges(badgesResult.value);
      }

      // Wallet + Guarantee (non-critical)
      populateGuarantee(
        walletResult.status === "fulfilled" ? walletResult.value : null,
        guaranteeResult.status === "fulfilled" ? guaranteeResult.value : null
      );

      setLoading(false);
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [
    apiBase,
    featureBase,
    authed,
    populateProfile,
    populateAvatar,
    populateBadges,
    populateGuarantee,
  ]);

  useEffect(() => {
    if (focus !== "passkeys" || loading) return;
    if (!passkeySectionRef.current) return;

    passkeySectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    const showId = window.setTimeout(() => {
      setHighlightPasskeySection(true);
    }, 0);

    const hideId = window.setTimeout(() => {
      setHighlightPasskeySection(false);
    }, 2000);

    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(hideId);
    };
  }, [focus, loading]);

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
    username: profile.username,
    form: profile.form,
    setForm: profile.setForm,
    socials: profile.socials,
    telegramAuth: profile.telegramAuth,
    setTelegramAuth: profile.setTelegramAuth,

    // Avatar
    avatarUrl: avatar.avatarUrl,
    avatarFile: avatar.avatarFile,
    avatarPreview: avatar.avatarPreview,
    avatarUploading: avatar.avatarUploading,
    avatarDeleting: avatar.avatarDeleting,
    onAvatarFileChange: avatar.onAvatarFileChange,
    onCancelAvatarPreview: avatar.cancelAvatarPreview,
    onUploadAvatar: avatar.uploadAvatar,
    onDeleteAvatar: avatar.deleteAvatar,

    // Badges
    badges: badgesHook.badges,
    primaryBadgeId: badgesHook.primaryBadgeId,
    savingBadge: badgesHook.savingBadge,
    onSavePrimaryBadge: badgesHook.savePrimaryBadge,

    // Profile save
    profileDirty: profile.profileDirty,
    profileSaving: profile.profileSaving,
    profileSaveMessage: profile.profileSaveMessage,
    onSaveAccount: profile.saveAccount,

    // Socials
    updateSocial: profile.updateSocial,
    addSocial: profile.addSocial,
    removeSocial: profile.removeSocial,

    // Guarantee
    guaranteeAmount: guarantee.guaranteeAmount,
    guaranteeLoading: guarantee.guaranteeLoading,
    walletBalance: guarantee.walletBalance,
    releaseGuaranteePin: guarantee.releaseGuaranteePin,
    setReleaseGuaranteePin: guarantee.setReleaseGuaranteePin,
    setGuaranteeAmountInput: guarantee.setGuaranteeAmountInput,
    setSetGuaranteeAmountInput: guarantee.setSetGuaranteeAmountInput,
    setGuaranteePin: guarantee.setGuaranteePin,
    setSetGuaranteePin: guarantee.setSetGuaranteePin,
    guaranteeReleasing: guarantee.guaranteeReleasing,
    guaranteeSubmitting: guarantee.guaranteeSubmitting,
    onSubmitSetGuarantee: guarantee.submitSetGuarantee,
    onSubmitReleaseGuarantee: guarantee.submitReleaseGuarantee,

    // Passkey highlight
    passkeySectionRef,
    highlightPasskeySection,

    // API base (needed by DeleteAccountSection)
    apiBase,
  };
}
