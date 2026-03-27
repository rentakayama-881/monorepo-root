"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Portal from "@/components/ui/Portal";

const PROXY_REGEX = /^(socks[45]|https?):\/\/.+:\d+$/i;

function validateForm(values) {
  const errors = {};
  if (!values.name || !values.name.trim()) {
    errors.name = "Nama profil wajib diisi.";
  }
  if (
    values.proxy_server &&
    values.proxy_server.trim() &&
    !PROXY_REGEX.test(values.proxy_server.trim())
  ) {
    errors.proxy_server = "Format proxy tidak valid. Contoh: socks5://proxy.example.com:1080";
  }
  return errors;
}

export default function ProfileModal({ open, profile, onSave, onClose, saving }) {
  const isEdit = Boolean(profile?.id);

  const [values, setValues] = useState({
    name: profile?.name || "",
    proxy_server: profile?.proxy_server || profile?.proxy_host || "",
    proxy_username: profile?.proxy_username || "",
    proxy_password: profile?.proxy_password || "",
    notes: profile?.notes || "",
  });
  const [errors, setErrors] = useState({});

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleChange = useCallback(
    (field) => (e) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave?.({
      name: values.name.trim(),
      proxy_server: values.proxy_server.trim() || undefined,
      proxy_username: values.proxy_username.trim() || undefined,
      proxy_password: values.proxy_password.trim() || undefined,
      notes: values.notes.trim() || undefined,
    });
  }

  if (!open) return null;

  const inputClass = cn(
    "w-full rounded-[var(--radius)] bg-muted/50 px-3 py-2 text-sm text-foreground",
    "placeholder:text-muted-foreground transition-colors",
    "focus:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  );

  const labelClass = "block text-xs font-medium text-foreground mb-1";

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit Profil Browser" : "Buat Profil Browser Baru"}
        className={cn(
          "fixed z-[110] bg-card shadow-2xl",
          "bottom-0 left-0 w-full max-h-[90vh] rounded-t-2xl",
          "md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-lg md:rounded-[var(--radius)]",
          "animate-slide-up md:animate-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {isEdit ? "Edit Profil" : "Profil Baru"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto max-h-[calc(90vh-120px)] p-5 space-y-4"
        >
          {/* Nama */}
          <div>
            <label htmlFor="profile-name" className={labelClass}>
              Nama Profil <span className="text-destructive">*</span>
            </label>
            <input
              id="profile-name"
              type="text"
              value={values.name}
              onChange={handleChange("name")}
              placeholder="Contoh: Akun Utama"
              className={cn(inputClass, errors.name && "ring-2 ring-destructive")}
              autoFocus
            />
            {errors.name ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" /> {errors.name}
              </p>
            ) : null}
          </div>

          {/* Proxy Server */}
          <div>
            <label htmlFor="profile-proxy" className={labelClass}>
              Proxy Server
            </label>
            <input
              id="profile-proxy"
              type="text"
              value={values.proxy_server}
              onChange={handleChange("proxy_server")}
              placeholder="socks5://proxy.example.com:1080"
              className={cn(inputClass, errors.proxy_server && "ring-2 ring-destructive")}
            />
            {errors.proxy_server ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" /> {errors.proxy_server}
              </p>
            ) : null}
          </div>

          {/* Proxy auth (side by side) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-proxy-user" className={labelClass}>
                Username Proxy
              </label>
              <input
                id="profile-proxy-user"
                type="text"
                value={values.proxy_username}
                onChange={handleChange("proxy_username")}
                placeholder="opsional"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="profile-proxy-pass" className={labelClass}>
                Password Proxy
              </label>
              <input
                id="profile-proxy-pass"
                type="password"
                value={values.proxy_password}
                onChange={handleChange("proxy_password")}
                placeholder="opsional"
                className={inputClass}
              />
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label htmlFor="profile-notes" className={labelClass}>
              Catatan
            </label>
            <textarea
              id="profile-notes"
              value={values.notes}
              onChange={handleChange("notes")}
              placeholder="Catatan opsional untuk profil ini..."
              rows={3}
              className={cn(inputClass, "resize-none")}
            />
          </div>

          {/* Info fingerprint */}
          <p className="text-[11px] text-muted-foreground">
            Fingerprint browser (User-Agent, platform, WebGL, dll.) akan di-generate otomatis saat
            profil dibuat.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[var(--radius)] px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}
