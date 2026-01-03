"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Alert from "../../components/ui/Alert";
import Select from "../../components/ui/Select";
import { BadgeChip } from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import { getApiBase, fetchJsonAuth } from "@/lib/api";
import { maskEmail } from "@/lib/email";
import TOTPSettings from "@/components/TOTPSettings";
import PasskeySettings from "@/components/PasskeySettings";
import { useSudoAction } from "@/components/SudoModal";

export default function AccountPage() {
  const API = `${getApiBase()}/api`;
  const authed = useMemo(() => { try { return !!localStorage.getItem("token"); } catch { return false; } }, []);
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

  useEffect(() => {
    if (!authed) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = localStorage.getItem("token");
    fetch(`${API}/account/me`, { headers: { Authorization: `Bearer ${t}` }})
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Gagal memuat akun")))
      .then(data => {
        if (cancelled) return;
        setMe(data);
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
        setForm({
          full_name: data.full_name || "",
          bio: data.bio || "",
          pronouns: data.pronouns || "",
          company: data.company || "",
          telegram: data.telegram || "",
        });
        const s = Array.isArray(data.social_accounts) ? data.social_accounts : [];
        setSocials(s.length ? s : [{ label: "", url: "" }]);
      })
      .catch(e => setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [API, authed]);

  // Fetch user badges
  useEffect(() => {
    if (!authed) return;
    const t = localStorage.getItem("token");
    fetch(`${API}/account/badges`, { headers: { Authorization: `Bearer ${t}` }})
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setBadges(data.badges || []);
        setPrimaryBadgeId(data.primary_badge_id || null);
      })
      .catch(() => {});
  }, [API, authed]);

  async function savePrimaryBadge(badgeId) {
    setError(""); setOk(""); setSavingBadge(true);
    try {
      const t = localStorage.getItem("token");
      const r = await fetch(`${API}/account/primary-badge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ badge_id: badgeId ? Number(badgeId) : null }),
      });
      if (!r.ok) throw new Error("Gagal menyimpan primary badge");
      setPrimaryBadgeId(badgeId ? Number(badgeId) : null);
      setOk("Primary badge diperbarui.");
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
      const t = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", avatarFile);
      const r = await fetch(`${API}/account/avatar`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${t}` },
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
      const t = localStorage.getItem("token");
      const r = await fetch(`${API}/account/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
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
    setError(""); setOk("");
    try {
      const t = localStorage.getItem("token");
      const body = { ...form, social_accounts: socials.filter(s => s.label || s.url) };
      const r = await fetch(`${API}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text() || "Gagal menyimpan akun");
      setOk("Akun diperbarui.");
    } catch (e) { setError(String(e.message || e)); }
  }

  async function changeUsername() {
    setError(""); setOk(""); setChgLoading(true);
    try {
      if (!newUsername) throw new Error("Masukkan username baru");
      const t = localStorage.getItem("token");
      const r = await fetch(`${API}/account/change-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
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
      <div className="rounded-lg border border-[rgb(var(--error-border))] bg-[rgb(var(--error-bg))] p-4 text-sm text-[rgb(var(--error))]">
        Anda harus login untuk mengelola akun.
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-xl font-semibold text-[rgb(var(--fg))]">Account</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--border))] border-t-[rgb(var(--fg))]" /> Loading...
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Foto Profil</h3>
            <div className="mt-3 flex items-start gap-4">
              <div className="shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-16 w-16 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] object-cover"
                  />
                ) : (
                  <Avatar src={avatarUrl} name={username || me?.full_name || me?.email} size="lg" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                {/* Show delete button if has avatar and not uploading */}
                {avatarUrl && !avatarFile && (
                  <div className="mb-3">
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
                  </div>
                )}
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={onAvatarFileChange}
                  label=""
                  className="block w-full text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={uploadAvatar}
                    disabled={avatarUploading || !avatarFile}
                    loading={avatarUploading}
                  >
                    Simpan Foto
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(""); }}
                    >
                      Batal
                    </Button>
                  )}
                </div>
                <div className="text-xs text-[rgb(var(--muted))]">Gunakan gambar rasio 1:1 untuk hasil terbaik. Max ~2MB (sesuaikan backend).</div>
              </div>
            </div>
          </section>

          {/* Badges Section */}
          <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Badges</h3>
            <div className="mt-3 space-y-3">
              {badges.length === 0 ? (
                <p className="text-sm text-[rgb(var(--muted))]">Badge hanya di dapatkan dari reputasi & kontribusi, baik internal maupun eksternal platform yang mempunyai legitimasi.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <BadgeChip key={badge.id} badge={badge} />
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="text-sm font-medium text-[rgb(var(--fg))]">Primary Badge (tampil di username)</label>
                    <div className="mt-2 flex items-center gap-2">
                      <Select
                        value={primaryBadgeId || ""}
                        onChange={(e) => savePrimaryBadge(e.target.value)}
                        disabled={savingBadge}
                        className="flex-1"
                      >
                        <option value="">Tidak ada badge ditampilkan</option>
                        {badges.map((badge) => (
                          <option key={badge.id} value={badge.id}>{badge.name}</option>
                        ))}
                      </Select>
                      {savingBadge && (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--border))] border-t-[rgb(var(--fg))]" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[rgb(var(--muted))]">Badge yang dipilih akan muncul di samping username Anda.</p>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Email</h3>
            <div className="mt-3 space-y-3">
              {me?.email && (
                <div className="flex items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[rgb(var(--fg))]">{maskEmail(me.email)}</span>
                    {me.is_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--success-bg))] px-2 py-0.5 text-xs font-medium text-[rgb(var(--success))]">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Terverifikasi
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="text-xs text-[rgb(var(--muted))]">
                Email Anda digunakan untuk login dan notifikasi penting.
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Profil</h3>
            <form onSubmit={saveAccount} className="mt-3 space-y-3">
              <Input
                label="Name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
              <div>
                <label className="text-sm font-medium text-[rgb(var(--fg))]">Bio</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--brand))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--brand))]"
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
                label="Contact Telegram"
                placeholder="@username"
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
              <div className="pt-2">
                <Button type="submit">Simpan</Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Username</h3>
            <div className="mt-1 text-sm text-[rgb(var(--fg))]">Saat ini: <b>{username || "(belum ada)"}</b></div>
            <div className="mt-3 rounded-md border border-[rgb(var(--warning-border))] bg-[rgb(var(--warning-bg))] p-3">
              <div className="flex items-center gap-2 text-sm text-[rgb(var(--warning))]">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="font-medium">Fitur Segera Hadir</span>
              </div>
              <p className="mt-1 text-xs text-[rgb(var(--warning))]/80">
                Fitur ganti username akan segera tersedia. Layanan ini berbayar Rp.100.000 dan saldo IDR akan dipotong otomatis.
              </p>
            </div>
          </section>

          {/* 2FA / TOTP Security Section */}
          <TOTPSettings />

          {/* Passkeys / WebAuthn Section */}
          <PasskeySettings />

          {/* Zona Berbahaya - Delete Account */}
          <DeleteAccountSection />

          {error && <Alert type="error" message={error} />}
          {ok && <Alert type="success" message={ok} />}
        </div>
      )}
    </main>
  );
}

// Separate component for delete account to use sudo hook
function DeleteAccountSection() {
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { execute: executeSudo } = useSudoAction("Menghapus akun secara permanen");

  async function handleDelete() {
    if (deleteConfirmation !== "DELETE") return;
    
    setDeleteError("");
    setDeleteLoading(true);
    
    try {
      // Request sudo mode dan langsung lakukan delete di dalam callback
      await executeSudo(async (sudoToken) => {
        if (!sudoToken) {
          throw new Error("Gagal mendapatkan token sudo");
        }
        
        await fetchJsonAuth("/api/account", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-Sudo-Token": sudoToken,
          },
          body: JSON.stringify({
            confirmation: deleteConfirmation,
          }),
        });
        
        // Clean logout
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("sudo_token");
        localStorage. removeItem("sudo_expires");
        
        // Redirect setelah operasi selesai
        window.location.href = "/";
      });
      
    } catch (err) {
      if (err.message === "Verifikasi dibatalkan") {
        // User cancelled sudo modal - tidak perlu tampilkan error
        return;
      }
      // Tampilkan error yang lebih informatif
      if (err.message === "Failed to fetch" || err.name === "TypeError") {
        setDeleteError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      } else {
        setDeleteError(err.message || "Terjadi kesalahan saat menghapus akun");
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="rounded-lg border-2 border-[rgb(var(--error-border))] bg-[rgb(var(--error-bg))] p-4">
      <h3 className="text-sm font-medium text-[rgb(var(--error))] flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-. 866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
        Zona Berbahaya
      </h3>
      <p className="mt-2 text-xs text-[rgb(var(--error))]/80">
        Menghapus akun akan menghapus semua data Anda secara permanen termasuk semua thread yang pernah dibuat.  
        Aksi ini tidak dapat dibatalkan.
      </p>
      
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--error))] mb-1">
            Ketik <span className="font-mono font-bold">DELETE</span> untuk konfirmasi
          </label>
          <Input
            type="text"
            placeholder="DELETE"
            value={deleteConfirmation}
            onChange={e => setDeleteConfirmation(e.target.value)}
          />
        </div>
        
        {deleteError && <Alert type="error" message={deleteError} />}
        
        <Button
          variant="danger"
          className="w-full disabled:opacity-50"
          disabled={deleteLoading || deleteConfirmation !== "DELETE"}
          loading={deleteLoading}
          onClick={handleDelete}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Hapus Akun Permanen
        </Button>
        
        <p className="text-xs text-[rgb(var(--muted))] text-center">
          Akan diminta verifikasi identitas sebelum menghapus
        </p>
      </div>
    </section>
  );
}
