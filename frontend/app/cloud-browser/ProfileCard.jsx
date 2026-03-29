"use client";

import { cn } from "@/lib/utils";
import { Monitor, Globe, Shield, Clock, Play, Eye, Pencil, Trash2 } from "lucide-react";

const PLATFORM_LABELS = {
  Win32: "Windows",
  MacIntel: "macOS",
  Linux: "Linux",
};

function formatLastUsed(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function ProfileCard({
  profile,
  activeSession,
  onStart,
  onViewSession,
  onEdit,
  onDelete,
  starting,
}) {
  const hasProxy = Boolean(profile.proxy_server || profile.proxy_host);
  const platform = profile.platform || profile.fingerprint?.platform || "Win32";
  const platformLabel = PLATFORM_LABELS[platform] || platform;
  const lastUsed = formatLastUsed(profile.last_used_at || profile.updated_at);
  const isActive = Boolean(activeSession);

  return (
    <article
      className={cn(
        "group relative rounded-[var(--radius)] bg-card p-4 transition-all",
        "hover:bg-accent/40 hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        isActive && "ring-1 ring-success/40"
      )}
    >
      <div className="space-y-3">
        {/* Header: icon + name */}
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            <Monitor className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug text-foreground break-words">
              {profile.name || "Profil Tanpa Nama"}
            </h3>
            {isActive ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <span
                  className="inline-block size-1.5 rounded-full bg-success animate-pulse"
                  aria-hidden="true"
                />
                Sesi aktif
              </span>
            ) : null}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Proxy badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              hasProxy ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            {hasProxy ? (
              <Shield className="size-2.5" aria-hidden="true" />
            ) : (
              <Globe className="size-2.5" aria-hidden="true" />
            )}
            {hasProxy ? "Proxy aktif" : "Tanpa proxy"}
          </span>

          {/* Platform badge */}
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {platformLabel}
          </span>
        </div>

        {/* Last used */}
        {lastUsed ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-2.5" aria-hidden="true" />
            <span>Terakhir digunakan {lastUsed}</span>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 pt-1">
          {isActive ? (
            <button
              type="button"
              onClick={() => onViewSession?.(activeSession)}
              className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-success/10 px-2.5 py-1 text-xs font-semibold text-success transition-colors hover:bg-success/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Eye className="size-3" aria-hidden="true" />
              Lihat Sesi
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStart?.(profile)}
              disabled={starting}
              className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Play className="size-3" aria-hidden="true" />
              {starting ? "Memulai..." : "Mulai Sesi"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit?.(profile)}
            className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Edit ${profile.name || "profil"}`}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onDelete?.(profile)}
            className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Hapus ${profile.name || "profil"}`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="rounded-[var(--radius)] bg-card p-4" aria-hidden="true">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="flex justify-end gap-1.5">
          <div className="h-7 w-20 animate-pulse rounded-[var(--radius)] bg-muted" />
          <div className="h-7 w-7 animate-pulse rounded-[var(--radius)] bg-muted" />
          <div className="h-7 w-7 animate-pulse rounded-[var(--radius)] bg-muted" />
        </div>
      </div>
    </div>
  );
}
