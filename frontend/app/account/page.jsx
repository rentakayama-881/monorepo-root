"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AvatarSection from "@/components/account/AvatarSection";
import BadgesSection from "@/components/account/BadgesSection";
import DeleteAccountSection from "@/components/account/DeleteAccountSection";
import GuaranteeSection from "@/components/account/GuaranteeSection";
import ProfileSection from "@/components/account/ProfileSection";
import TelegramAuthSection from "@/components/account/TelegramAuthSection";
import UsernameSection from "@/components/account/UsernameSection";
import PasskeySettings from "@/components/PasskeySettings";
import TOTPSettings from "@/components/TOTPSettings";
import Alert from "@/components/ui/Alert";
import { CenteredSpinner } from "@/components/ui/LoadingState";
import { getToken } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";

function normalizeAccountPayload(formValue = {}, socialsValue = []) {
  const normalizedSocials = (Array.isArray(socialsValue) ? socialsValue : [])
    .map((item) => ({
      label: String(item?.label || "").trim(),
      url: String(item?.url || "").trim(),
    }))
    .filter((item) => item.label || item.url);

  return {
    full_name: String(formValue.full_name || ""),
    bio: String(formValue.bio || ""),
    pronouns: String(formValue.pronouns || ""),
    company: String(formValue.company || ""),
    social_accounts: normalizedSocials,
  };
}

function normalizeTelegramAuth(value = {}) {
  const src = value && typeof value === "object" ? value : {};
  return {
    connected: Boolean(src.connected),
    telegram_user_id: String(src.telegram_user_id || ""),
    username: String(src.username || ""),
    display_username: String(src.display_username || ""),
    deep_link: String(src.deep_link || ""),
    verified_at: String(src.verified_at || ""),
    first_name: String(src.first_name || ""),
    last_name: String(src.last_name || ""),
    photo_url: String(src.photo_url || ""),
  };
}

function AccountPageContent() {
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
  const [telegramAuth, setTelegramAuth] = useState(() => normalizeTelegramAuth({ connected: false }));

  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  const [badges, setBadges] = useState([]);
  const [primaryBadgeId, setPrimaryBadgeId] = useState(null);
  const [savingBadge, setSavingBadge] = useState(false);

  const featureBase = useMemo(() => process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id", []);
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
  const [savedProfileSignature, setSavedProfileSignature] = useState(JSON.stringify(normalizeAccountPayload({}, [])));
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

    const loadAccount = async () => {
      try {
        const response = await fetchWithAuth(`${apiBase}/account/me`);
        if (!response.ok) throw new Error("Gagal memuat akun");

        const data = await response.json();
        if (cancelled) return;

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
        setSocials(normalized.social_accounts.length ? normalized.social_accounts : [{ label: "", url: "" }]);
        setTelegramAuth(normalizeTelegramAuth(data.telegram_auth));
        setSavedProfileSignature(JSON.stringify(normalized));
        setProfileSaveMessage("");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAccount();
    return () => {
      cancelled = true;
    };
  }, [apiBase, authed]);

  useEffect(() => {
    if (!authed) return;

    const loadBadges = async () => {
      try {
        const response = await fetchWithAuth(`${apiBase}/account/badges`);
        if (!response.ok) return;

        const data = await response.json();
        setBadges(data.badges || []);
        setPrimaryBadgeId(data.primary_badge_id || null);
      } catch {
        // Ignore badge fetch errors.
      }
    };

    loadBadges();
  }, [apiBase, authed]);

  function generateIdempotencyKey() {
    return crypto.randomUUID();
  }

  async function loadWalletAndGuarantee() {
    if (!authed) return;

    setGuaranteeLoading(true);
    try {
      const walletResponse = await fetchWithAuth(`${featureBase}/api/v1/wallets/me`);
      if (walletResponse.ok) {
        const wallet = await walletResponse.json();
        setWalletBalance(typeof wallet?.balance === "number" ? wallet.balance : 0);
      }

      const guaranteeResponse = await fetchWithAuth(`${featureBase}/api/v1/guarantees/me`);
      if (guaranteeResponse.ok) {
        const guarantee = await guaranteeResponse.json();
        setGuaranteeAmount(typeof guarantee?.amount === "number" ? guarantee.amount : 0);
      }
    } catch {
      // Ignore feature-service errors on account page.
    } finally {
      setGuaranteeLoading(false);
    }
  }

  useEffect(() => {
    loadWalletAndGuarantee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, featureBase]);

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
      if (!setGuaranteePin || String(setGuaranteePin).length !== 6) throw new Error("PIN harus 6 digit");

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
      setOk("Primary badge diperbarui. Halaman akan direfresh...");

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBadge(false);
    }
  }

  function updateSocial(index, key, value) {
    setSocials((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }

  function addSocial() {
    setSocials((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeSocial(index) {
    setSocials((prev) => prev.filter((_, idx) => idx !== index));
  }

  function onAvatarFileChange(event) {
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
  }

  function cancelAvatarPreview() {
    setAvatarFile(null);
    setAvatarPreview("");
  }

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

  if (!authed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Anda harus login untuk mengelola akun.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {setup2fa === "true" && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-warning shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="font-semibold text-warning">2FA Diperlukan untuk Fitur Wallet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Untuk menggunakan fitur kirim uang, tarik saldo, dan set PIN, Anda harus mengaktifkan 2FA terlebih dahulu.
                Scroll ke bawah ke bagian &quot;Keamanan&quot; dan klik tombol &quot;Aktifkan 2FA&quot;.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {loading ? (
        <div className="rounded-[var(--radius)] border border-border bg-card p-4">
          <CenteredSpinner className="justify-start" sizeClass="h-5 w-5" />
        </div>
      ) : (
        <div className="space-y-6">
          {error && <Alert variant="error" message={error} />}
          {ok && <Alert variant="success" message={ok} />}

          <AvatarSection
            avatarPreview={avatarPreview}
            avatarUrl={avatarUrl}
            displayName={username || me?.full_name || me?.email}
            avatarFile={avatarFile}
            avatarDeleting={avatarDeleting}
            avatarUploading={avatarUploading}
            onAvatarFileChange={onAvatarFileChange}
            onDeleteAvatar={deleteAvatar}
            onUploadAvatar={uploadAvatar}
            onCancelAvatarPreview={cancelAvatarPreview}
          />

          <BadgesSection
            badges={badges}
            primaryBadgeId={primaryBadgeId}
            savingBadge={savingBadge}
            onSavePrimaryBadge={savePrimaryBadge}
          />

          <GuaranteeSection
            guaranteeAmount={guaranteeAmount}
            guaranteeLoading={guaranteeLoading}
            walletBalance={walletBalance}
            releaseGuaranteePin={releaseGuaranteePin}
            setReleaseGuaranteePin={setReleaseGuaranteePin}
            setGuaranteeAmountInput={setGuaranteeAmountInput}
            setSetGuaranteeAmountInput={setSetGuaranteeAmountInput}
            setGuaranteePin={setGuaranteePin}
            setSetGuaranteePin={setSetGuaranteePin}
            guaranteeReleasing={guaranteeReleasing}
            guaranteeSubmitting={guaranteeSubmitting}
            onSubmitReleaseGuarantee={submitReleaseGuarantee}
            onSubmitSetGuarantee={submitSetGuarantee}
          />

          <ProfileSection
            form={form}
            setForm={setForm}
            socials={socials}
            updateSocial={updateSocial}
            removeSocial={removeSocial}
            addSocial={addSocial}
            profileDirty={profileDirty}
            profileSaving={profileSaving}
            profileSaveMessage={profileSaveMessage}
            onSaveAccount={saveAccount}
          />

          <TelegramAuthSection
            telegramAuth={telegramAuth}
            onTelegramAuthChange={setTelegramAuth}
          />

          <UsernameSection username={username} />

          <TOTPSettings />
          <div
            id="passkey-settings"
            ref={passkeySectionRef}
            className={`rounded-[var(--radius)] transition-shadow duration-300 ${
              highlightPasskeySection
                ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                : ""
            }`}
          >
            <PasskeySettings />
          </div>
          <DeleteAccountSection apiBase={apiBase} />
        </div>
      )}
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[var(--radius)] border border-border bg-card p-4">
            <CenteredSpinner className="justify-start" sizeClass="h-5 w-5" />
          </div>
        </main>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
