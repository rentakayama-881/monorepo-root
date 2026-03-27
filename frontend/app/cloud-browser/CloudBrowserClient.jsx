"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useProfiles, useActiveSessions, usePricing } from "./useCloudBrowser";
import { createProfile, updateProfile, deleteProfile, startSession } from "@/lib/browserApi";
import PricingBanner from "./PricingBanner";
import ProfileCard, { ProfileCardSkeleton } from "./ProfileCard";
import ProfileModal from "./ProfileModal";

export default function CloudBrowserClient() {
  const router = useRouter();

  // SWR data
  const {
    profiles,
    isLoading: profilesLoading,
    error: profilesError,
    mutate: mutateProfiles,
  } = useProfiles();
  const { sessions, isLoading: sessionsLoading, mutate: mutateSessions } = useActiveSessions();
  const { pricing } = usePricing();

  // Local state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [startingId, setStartingId] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Map session to profile for quick lookup
  const sessionByProfileId = {};
  for (const s of sessions) {
    if (s.profile_id) {
      sessionByProfileId[s.profile_id] = s;
    }
  }

  // Active sessions count
  const activeCount = sessions.length;

  // Handlers
  const handleOpenCreate = useCallback(() => {
    setEditingProfile(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((profile) => {
    setEditingProfile(profile);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setEditingProfile(null);
  }, [saving]);

  const handleSaveProfile = useCallback(
    async (data) => {
      setSaving(true);
      setFeedback(null);
      try {
        if (editingProfile?.id) {
          await updateProfile(editingProfile.id, data);
        } else {
          await createProfile(data);
        }
        await mutateProfiles();
        setModalOpen(false);
        setEditingProfile(null);
      } catch (err) {
        setFeedback({ message: err?.message || "Gagal menyimpan profil.", variant: "error" });
      } finally {
        setSaving(false);
      }
    },
    [editingProfile, mutateProfiles]
  );

  const handleDelete = useCallback(
    async (profile) => {
      if (!confirm(`Hapus profil "${profile.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
      setFeedback(null);
      try {
        await deleteProfile(profile.id);
        await mutateProfiles();
      } catch (err) {
        setFeedback({ message: err?.message || "Gagal menghapus profil.", variant: "error" });
      }
    },
    [mutateProfiles]
  );

  const handleStartSession = useCallback(
    async (profile) => {
      setStartingId(profile.id);
      setFeedback(null);
      try {
        const result = await startSession(profile.id);
        await mutateSessions();
        const sessionId = result?.session?.id || result?.id;
        if (sessionId) {
          router.push(`/cloud-browser/session/${encodeURIComponent(sessionId)}`);
        }
      } catch (err) {
        setFeedback({
          message: err?.message || "Gagal memulai sesi browser.",
          variant: "error",
        });
      } finally {
        setStartingId("");
      }
    },
    [mutateSessions, router]
  );

  const handleViewSession = useCallback(
    (session) => {
      if (session?.id) {
        router.push(`/cloud-browser/session/${encodeURIComponent(session.id)}`);
      }
    },
    [router]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      await Promise.all([mutateProfiles(), mutateSessions()]);
    } catch (err) {
      setFeedback({ message: "Gagal memuat ulang data.", variant: "error" });
    } finally {
      setRefreshing(false);
    }
  }, [mutateProfiles, mutateSessions]);

  const loading = profilesLoading || sessionsLoading;

  return (
    <div className="space-y-6 [scrollbar-gutter:stable]">
      {/* Pricing Banner */}
      <PricingBanner pricing={pricing} />

      {/* Active sessions banner */}
      {activeCount > 0 ? (
        <div className="flex items-center gap-2 rounded-[var(--radius)] bg-success/10 px-4 py-2.5 text-sm text-success">
          <span
            className="inline-block size-2 rounded-full bg-success animate-pulse"
            aria-hidden="true"
          />
          <span className="font-medium">{activeCount} sesi aktif</span>
          <span className="text-success/70">— biaya berjalan dihitung per menit</span>
        </div>
      ) : null}

      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Smart Browser</h1>
          <p className="text-xs text-muted-foreground">
            Kelola profil browser anti-detect Anda. Setiap profil memiliki fingerprint unik.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">
              {refreshing ? "Memuat ulang..." : "Muat ulang"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus className="size-3.5" />
            Buat Profil
          </button>
        </div>
      </header>

      {/* Feedback */}
      {feedback ? (
        <div
          className={cn(
            "rounded-[var(--radius)] px-4 py-3 text-sm",
            feedback.variant === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-success/10 text-success"
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {/* Error state */}
      {profilesError ? (
        <div className="rounded-[var(--radius)] bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {profilesError.message || "Gagal memuat profil."}
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProfileCardSkeleton key={i} />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          compact
          title="Belum ada profil browser"
          description="Buat profil pertama Anda untuk mulai menggunakan Smart Browser."
          icon="🖥️"
          action={
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus className="size-3.5" />
              Buat Profil Baru
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              activeSession={sessionByProfileId[profile.id] || null}
              onStart={handleStartSession}
              onViewSession={handleViewSession}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              starting={startingId === profile.id}
            />
          ))}
        </div>
      )}

      {/* Profile Modal — key resets internal state when profile changes */}
      <ProfileModal
        key={editingProfile?.id ?? "new"}
        open={modalOpen}
        profile={editingProfile}
        onSave={handleSaveProfile}
        onClose={handleCloseModal}
        saving={saving}
      />
    </div>
  );
}
