"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Alert from "../../components/ui/Alert";
import Select from "../../components/ui/Select";
import { BadgeChip } from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fetchWithAuth, getValidToken } from "@/lib/tokenRefresh";
import TOTPSettings from "@/components/TOTPSettings";
import PasskeySettings from "@/components/PasskeySettings";
import { useSudoAction } from "@/components/SudoModal";
import { useCanDeleteAccount } from "@/lib/swr";

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
    telegram: String(formValue.telegram || ""),
    social_accounts: normalizedSocials,
  };
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa");
  const redirectAfter2fa = searchParams.get("redirect");
  const API = `${getApiBase()}/api`;
  const authed = useMemo(() => { try { return !!getToken(); } catch { return false; } }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [me, setMe] = useState(null);
  const [socials, setSocials] = useState([{ label: "", url: "" }]);
  const [form, setForm] = useState({ full_name: "", bio: "", pronouns: "", company: "", telegram: "" });
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [chgLoading, setChgLoading] = useState(false);
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

  const profilePayload = useMemo(
    () => normalizeAccountPayload(form, socials),
    [form, socials]
  );
  const profilePayloadSignature = useMemo(
    () => JSON.stringify(profilePayload),
    [profilePayload]
  );
  const profileDirty = profilePayloadSignature !== savedProfileSignature;

  useEffect(() => {
    if (profileDirty) {
      setProfileSaveMessage("");
    }
  }, [profileDirty]);

  useEffect(() => {
    if (!authed) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const loadAccount = async () => {
      try {
        const r = await fetchWithAuth(`${API}/account/me`);
        if (!r.ok) throw new Error("Gagal memuat akun");
        const data = await r.json();
        if (cancelled) return;
        setMe(data);
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
        const nextForm = {
          full_name: data.full_name || "",
          bio: data.bio || "",
          pronouns: data.pronouns || "",
          company: data.company || "",
          telegram: data.telegram || "",
        };
        const socialAccounts = Array.isArray(data.social_accounts) ? data.social_accounts : [];
        const normalized = normalizeAccountPayload(nextForm, socialAccounts);
        setForm(nextForm);
        setSocials(
          normalized.social_accounts.length
            ? normalized.social_accounts
            : [{ label: "", url: "" }]
        );
        setSavedProfileSignature(JSON.stringify(normalized));
        setProfileSaveMessage("");
      } catch (e) {
        setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAccount();
    return () => { cancelled = true; };
  }, [API, authed]);

  // Fetch user badges
  useEffect(() => {
    if (!authed) return;
    const loadBadges = async () => {
      try {
        const r = await fetchWithAuth(`${API}/account/badges`);
        if (!r.ok) return;
        const data = await r.json();
        setBadges(data.badges || []);
        setPrimaryBadgeId(data.primary_badge_id || null);
      } catch {
        // Ignore badge fetch errors
      }
    };
    loadBadges();
  }, [API, authed]);

  function generateIdempotencyKey() {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch {
      // ignore
    }
    return `idem_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  }

  async function loadWalletAndGuarantee() {
    if (!authed) return;
    setGuaranteeLoading(true);
    try {
      const walletRes = await fetchWithAuth(`${featureBase}/api/v1/wallets/me`);
      if (walletRes.ok) {
        const w = await walletRes.json();
        setWalletBalance(typeof w?.balance === "number" ? w.balance : 0);
      }

      const gRes = await fetchWithAuth(`${featureBase}/api/v1/guarantees/me`);
      if (gRes.ok) {
        const g = await gRes.json();
        setGuaranteeAmount(typeof g?.amount === "number" ? g.amount : 0);
      }
    } catch {
      // Ignore feature-service fetch errors on account page
    } finally {
      setGuaranteeLoading(false);
    }
  }

  useEffect(() => {
    loadWalletAndGuarantee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, featureBase]);

  async function submitSetGuarantee(e) {
    e.preventDefault();
    setError(""); setOk("");
    setGuaranteeSubmitting(true);
    try {
      const amount = Number(setGuaranteeAmountInput);
      if (!Number.isFinite(amount)) throw new Error("Jumlah jaminan tidak valid");
      if (amount < 100000) throw new Error("Minimal jaminan adalah Rp 100.000");
      if (walletBalance != null && amount > walletBalance) throw new Error("Saldo tidak mencukupi");
      if (!setGuaranteePin || String(setGuaranteePin).length !== 6) throw new Error("PIN harus 6 digit");

      const r = await fetchWithAuth(`${featureBase}/api/v1/guarantees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount, pin: setGuaranteePin }),
      });

      const txt = await r.text();
      if (!r.ok) {
        let msg = txt;
        try {
          const j = JSON.parse(txt);
          msg = j?.error?.message || j?.message || j?.error || txt;
        } catch {}
        throw new Error(msg || "Gagal mengunci jaminan");
      }

      let data = {};
      try { data = JSON.parse(txt); } catch {}
      setGuaranteeAmount(typeof data?.amount === "number" ? data.amount : amount);
      setOk("Jaminan berhasil dikunci.");
      setSetGuaranteeAmountInput("");
      setSetGuaranteePin("");
      await loadWalletAndGuarantee();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setGuaranteeSubmitting(false);
    }
  }

  async function submitReleaseGuarantee(e) {
    e.preventDefault();
    setError(""); setOk("");
    setGuaranteeReleasing(true);
    try {
      if (!releaseGuaranteePin || String(releaseGuaranteePin).length !== 6) throw new Error("PIN harus 6 digit");

      const r = await fetchWithAuth(`${featureBase}/api/v1/guarantees/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ pin: releaseGuaranteePin }),
      });

      const txt = await r.text();
      if (!r.ok) {
        let msg = txt;
        try {
          const j = JSON.parse(txt);
          msg = j?.error?.message || j?.message || j?.error || txt;
        } catch {}
        throw new Error(msg || "Gagal melepaskan jaminan");
      }

      setGuaranteeAmount(0);
      setOk("Jaminan berhasil dilepaskan.");
      setReleaseGuaranteePin("");
      await loadWalletAndGuarantee();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setGuaranteeReleasing(false);
    }
  }

  async function savePrimaryBadge(badgeId) {
    setError(""); setOk(""); setSavingBadge(true);
    try {
      const r = await fetchWithAuth(`${API}/account/primary-badge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge_id: badgeId ? Number(badgeId) : null }),
      });
      if (!r.ok) throw new Error("Gagal menyimpan primary badge");
      setPrimaryBadgeId(badgeId ? Number(badgeId) : null);
      setOk("Primary badge diperbarui. Halaman akan direfresh...");
      // Auto refresh after 1.5 seconds to show updated badge
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSavingBadge(false);
    }
  }

  function updateSocial(i, key, val) {
    setSocials(prev => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [key]: val };
      return copy;
    });
  }
  function addSocial() { setSocials(prev => [...prev, { label: "", url: "" }]); }
  function removeSocial(i) { setSocials(prev => prev.filter((_, idx) => idx !== i)); }

  function onAvatarFileChange(e) {
    setOk(""); setError("");
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Validate extension
      const ext = file.name.toLowerCase().split('.').pop();
      if (!['jpg', 'jpeg', 'png'].includes(ext)) {
        setError("Format gambar harus JPG atau PNG");
        e.target.value = "";
        return;
      }
    }
    setAvatarFile(file || null);
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    } else {
      setAvatarPreview("");
    }
  }

  async function uploadAvatar() {
    setError(""); setOk(""); setAvatarUploading(true);
    try {
      if (!avatarFile) throw new Error("Pilih file gambar terlebih dahulu");
      const fd = new FormData();
      fd.append("file", avatarFile);
      const r = await fetchWithAuth(`${API}/account/avatar`, {
        method: "PUT",
        body: fd,
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt || "Gagal mengunggah avatar");
      let resp = {};
      try { resp = JSON.parse(txt); } catch {}
      const url = resp.avatar_url || avatarUrl || "";
      if (url) setAvatarUrl(url);
      setOk("Foto profil diperbarui.");
      setAvatarFile(null);
      setAvatarPreview("");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function deleteAvatar() {
    setError(""); setOk(""); setAvatarDeleting(true);
    try {
      const r = await fetchWithAuth(`${API}/account/avatar`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "Gagal menghapus foto profil");
      }
      setAvatarUrl("");
      setOk("Foto profil dihapus.");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setAvatarDeleting(false);
    }
  }

  async function saveAccount(e) {
    e.preventDefault();
    if (!profileDirty || profileSaving) return;
    setError(""); setOk(""); setProfileSaveMessage(""); setProfileSaving(true);
    try {
      const body = profilePayload;
      const r = await fetchWithAuth(`${API}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text() || "Gagal menyimpan akun");
      setSavedProfileSignature(profilePayloadSignature);
      setProfileSaveMessage("Perubahan profil disimpan.");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setProfileSaving(false);
    }
  }

  async function changeUsername() {
    setError(""); setOk(""); setChgLoading(true);
    try {
      if (!newUsername) throw new Error("Masukkan username baru");
      const r = await fetchWithAuth(`${API}/account/change-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_username: newUsername }),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt || "Gagal mengganti username");
      const data = JSON.parse(txt);
      setOk(`Username diubah menjadi ${data.new_username}.`);
      setUsername(data.new_username);
      setNewUsername("");
    } catch (e) { setError(String(e.message || e)); } finally { setChgLoading(false); }
  }

  if (!authed) return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        Anda harus login untuk mengelola akun.
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Alert banner when redirected for 2FA setup */}
      {setup2fa === "true" && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-warning shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="font-semibold text-warning">
                2FA Diperlukan untuk Fitur Wallet
              </p>
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
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" /> Loading...
        </div>
      ) : (
        <div className="space-y-6">
          {error && <Alert variant="error" message={error} />}
          {ok && <Alert variant="success" message={ok} />}

          {/* Profile Photo Section */}
          <section className="settings-section">
            <h3 className="settings-section-title mb-3">Foto Profil</h3>
            <div className="mt-3 flex items-start gap-4">
              <div className="shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-16 w-16 rounded-full border border-border bg-muted/50 object-cover"
                  />
                ) : (
                  <Avatar src={avatarUrl} name={username || me?.full_name || me?.email} size="lg" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={onAvatarFileChange}
                  label=""
                  className="block w-full text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {avatarUrl && !avatarFile && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={deleteAvatar}
                      disabled={avatarDeleting}
                      loading={avatarDeleting}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Hapus Foto
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={uploadAvatar}
                    disabled={avatarUploading || !avatarFile}
                    loading={avatarUploading}
                    size="sm"
                  >
                    Simpan Foto
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(""); }}
                    >
                      Batal
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Gunakan gambar rasio 1:1 untuk hasil terbaik. Maks ~2MB.</div>
              </div>
            </div>
          </section>

          {/* Badges Section */}
          <section className="settings-section">
            <h3 className="settings-section-title mb-3">Badges</h3>
            <div className="mt-3 space-y-3">
              {badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Badge hanya di dapatkan dari reputasi & kontribusi, baik internal maupun eksternal platform yang mempunyai legitimasi.</p>
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
                        onChange={(e) => savePrimaryBadge(e.target.value)}
                        disabled={savingBadge}
                        className="flex-1"
                      >
                        <option value="">Tidak ada badge ditampilkan</option>
                        {badges.map((badge) => (
                          <option key={badge.id} value={String(badge.id)}>{badge.name}</option>
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

          <section className="settings-section">
            <h3 className="settings-section-title mb-3">Jaminan Profil</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-foreground">
                    {guaranteeAmount > 0 ? (
                      <>
                        Jaminan Aktif:{" "}
                        <b>Rp {guaranteeAmount.toLocaleString("id-ID")}</b>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Belum ada jaminan aktif.</span>
                    )}
                  </div>
                  {guaranteeLoading && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
                  )}
                </div>
                {typeof walletBalance === "number" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Saldo tersedia: Rp {walletBalance.toLocaleString("id-ID")}
                  </div>
                )}
              </div>

              {guaranteeAmount > 0 ? (
                <form onSubmit={submitReleaseGuarantee} className="space-y-3">
                  <Input
                    label="PIN"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 digit"
                    value={releaseGuaranteePin}
                    onChange={(e) => setReleaseGuaranteePin(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={guaranteeReleasing}
                    loading={guaranteeReleasing}
                  >
                    Lepaskan Jaminan
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Untuk mengubah jumlah jaminan, lepaskan dulu lalu set ulang.
                  </div>
                </form>
              ) : (
                <form onSubmit={submitSetGuarantee} className="space-y-3">
                  <Input
                    label="Jumlah Jaminan (IDR)"
                    type="number"
                    min={100000}
                    step={1000}
                    placeholder="100000"
                    value={setGuaranteeAmountInput}
                    onChange={(e) => setSetGuaranteeAmountInput(e.target.value)}
                  />
                  <Input
                    label="PIN"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 digit"
                    value={setGuaranteePin}
                    onChange={(e) => setSetGuaranteePin(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground">
                    Minimal Rp 100.000
                    {typeof walletBalance === "number"
                      ? `, maksimal Rp ${walletBalance.toLocaleString("id-ID")}`
                      : ""}
                    .
                  </div>
                  <Button
                    type="submit"
                    disabled={guaranteeSubmitting}
                    loading={guaranteeSubmitting}
                  >
                    Kunci Jaminan
                  </Button>
                </form>
              )}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title mb-3">Profil</h3>
            <form onSubmit={saveAccount} className="mt-3 space-y-3">
              <Input
                label="Name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
              <div>
                <label className="text-sm font-medium text-foreground">Bio</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Pronouns"
                  value={form.pronouns}
                  onChange={e => setForm(f => ({ ...f, pronouns: e.target.value }))}
                />
                <Input
                  label="Company"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                />
              </div>
              <Input
                label="Telegram (Private Consultation Contact)"
                placeholder="@username (tidak ditampilkan publik)"
                value={form.telegram}
                onChange={e => setForm(f => ({ ...f, telegram: e.target.value }))}
              />
              <div>
                <label className="text-sm font-medium">Social Accounts</label>
                <div className="space-y-2 mt-2">
                  {socials.map((s, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 items-start">
                      <Input
                        placeholder="Label (Instagram, LinkedIn, Toko Shopee, dll)"
                        value={s.label || ""}
                        onChange={e => updateSocial(i, "label", e.target.value)}
                        className=""
                      />
                      <Input
                        placeholder="https://..."
                        value={s.url || ""}
                        onChange={e => updateSocial(i, "url", e.target.value)}
                        className=""
                      />
                      <div className="col-span-2 text-right">
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => removeSocial(i)}
                          className="text-xs px-2 py-1"
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addSocial}
                    className="text-sm"
                  >
                    + Tambah
                  </Button>
                </div>
              </div>
              <div className="pt-2 space-y-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!profileDirty || profileSaving}
                  loading={profileSaving}
                >
                  Simpan Profil
                </Button>
                {profileSaveMessage && (
                  <Alert variant="success" message={profileSaveMessage} compact />
                )}
              </div>
            </form>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title mb-3">Username</h3>
            <div className="mt-1 text-sm text-foreground">Saat ini: <b>{username || "(belum ada)"}</b></div>
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <div className="flex items-center gap-2 text-sm text-warning">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="font-medium">Fitur Segera Hadir</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Fitur ganti username akan segera tersedia. Layanan ini berbayar Rp.100.000 dan saldo IDR akan dipotong otomatis.
              </p>
            </div>
          </section>

          {/* 2FA / TOTP Security Section */}
          <TOTPSettings />

          {/* Passkeys / WebAuthn Section */}
          <PasskeySettings />

          {/* Zona Berbahaya - Delete Account */}
          <DeleteAccountSection API={API} router={router} />
        </div>
      )}
    </main>
  );
}

// Separate component for delete account to use sudo hook
function DeleteAccountSection({ API, router }) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { execute: executeSudo } = useSudoAction("Menghapus akun secara permanen");
  const { canDelete, blockingReasons, warnings, walletBalance, isLoading: checkingDelete } = useCanDeleteAccount();

  async function handleDelete() {
    if (deleteConfirmation !== "DELETE") return;

    setDeleteError("");
    setDeleteLoading(true);

    try {
      // Request sudo mode first
      await executeSudo(async (sudoToken) => {
        const t = await getValidToken();
        if (!t) {
          throw new Error("Sesi telah berakhir. Silakan login kembali.");
        }
        const res = await fetch(`${API}/account`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
            "X-Sudo-Token": sudoToken,
          },
          body: JSON.stringify({
            confirmation: deleteConfirmation,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal menghapus akun");
        }
        // Clean logout
        localStorage.removeItem("token");
        localStorage.removeItem("sudo_token");
        localStorage.removeItem("sudo_expires");
        router.push("/");
      });
    } catch (err) {
      if (err.message !== "Verifikasi dibatalkan") {
        setDeleteError(err.message);
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="rounded-lg border-2 border-destructive/20 bg-destructive/10 p-4">
      <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Zona Berbahaya
      </h3>
      <p className="mt-2 text-xs text-destructive/80">
        Menghapus akun akan menghapus semua data Anda secara permanen termasuk semua Validation Case yang pernah dibuat.
        Aksi ini tidak dapat dibatalkan.
      </p>

      {/* Loading state */}
      {checkingDelete && (
        <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
            Memeriksa status akun...
          </div>
        </div>
      )}

      {/* Blocking reasons - cannot delete */}
      {!checkingDelete && blockingReasons && blockingReasons.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-sm font-medium text-warning mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm0-13.5a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
            Akun tidak dapat dihapus karena:
          </p>
          <ul className="space-y-1">
            {blockingReasons.map((reason, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings - can delete but with caution */}
      {!checkingDelete && canDelete && warnings && warnings.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-sm font-medium text-warning mb-2">Peringatan:</p>
          <ul className="space-y-1">
            {warnings.map((warning, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-destructive mb-1">
            Ketik <span className="font-mono font-bold">DELETE</span> untuk konfirmasi
          </label>
          <Input
            type="text"
            placeholder="DELETE"
            value={deleteConfirmation}
            onChange={e => setDeleteConfirmation(e.target.value)}
            disabled={!canDelete}
          />
        </div>

        {deleteError && <Alert variant="error" message={deleteError} />}

        <Button
          variant="danger"
          className="w-full disabled:opacity-50"
          disabled={deleteLoading || deleteConfirmation !== "DELETE" || !canDelete}
          loading={deleteLoading}
          onClick={handleDelete}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          {canDelete ? "Hapus Akun Permanen" : "Tidak Dapat Menghapus Akun"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {canDelete ? "Akan diminta verifikasi identitas sebelum menghapus" : "Selesaikan semua transaksi terlebih dahulu"}
        </p>
      </div>
    </section>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" /> Loading...
        </div>
      </main>
    }>
      <AccountPageContent />
    </Suspense>
  );
}
