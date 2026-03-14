"use client";
import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileStats from "@/components/profile/ProfileStats";
import ProfileNav from "@/components/profile/ProfileNav";
import ProfileFooter from "@/components/profile/ProfileFooter";
import useProfileSidebar from "@/components/profile/useProfileSidebar";

const overlayClassName = "fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300";
const panelBaseClassName =
  "fixed right-2 top-[calc(var(--header-height)+0.375rem)] z-[110] w-[16.5rem] max-w-[calc(100vw-0.75rem)] rounded-2xl border border-border/75 bg-card/95 shadow-[0_14px_28px_rgba(0,0,0,0.18)] backdrop-blur-md flex flex-col max-h-[calc(100dvh-var(--header-height)-1rem)] animate-slide-in-from-right";
const panelPaddedClassName = `${panelBaseClassName} p-3`;

export default function ProfileSidebar({ onClose, triggerRef }) {
  const {
    pathname,
    user,
    wallet,
    guarantee,
    isLoading,
    isSigningOut,
    loadError,
    panelRef,
    displayName,
    handlePanelNavigation,
    handleLogout,
    handleRetry,
  } = useProfileSidebar({ onClose, triggerRef });

  if (loadError && !isLoading) {
    return (
      <>
        <div
          className={overlayClassName}
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          className={panelPaddedClassName}
          role="dialog"
          aria-modal="true"
          aria-label="Account panel"
          tabIndex={-1}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <div
          className={overlayClassName}
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          className={panelPaddedClassName}
          role="dialog"
          aria-modal="true"
          aria-label="Account panel"
          tabIndex={-1}
        >
          <div className="space-y-3.5" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2.5">
              <SkeletonCircle size="h-8 w-8" className="bg-muted-foreground/20 dark:bg-secondary" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonText width="w-28" className="bg-muted-foreground/20 dark:bg-secondary" />
                <SkeletonText
                  width="w-36"
                  height="h-3"
                  className="bg-muted-foreground/20 dark:bg-secondary"
                />
              </div>
              <Skeleton className="h-7 w-7 rounded-md bg-muted-foreground/20 dark:bg-secondary" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-md bg-muted-foreground/20 dark:bg-secondary" />
              <Skeleton className="h-9 w-full rounded-md bg-muted-foreground/20 dark:bg-secondary" />
              <Skeleton className="h-9 w-full rounded-md bg-muted-foreground/20 dark:bg-secondary" />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={overlayClassName} onClick={onClose} role="presentation" aria-hidden="true" />
      <div
        ref={panelRef}
        className={panelBaseClassName}
        role="dialog"
        aria-modal="true"
        aria-label="Account panel"
        tabIndex={-1}
        onClickCapture={handlePanelNavigation}
      >
        <ProfileCard user={user} displayName={displayName} onClose={onClose} />

        <div
          className="flex-1 overflow-y-auto p-3 pt-0 scrollbar-thin"
          style={{ overscrollBehavior: "contain" }}
        >
          <ProfileStats wallet={wallet} guarantee={guarantee} />
          <ProfileNav pathname={pathname} />
        </div>

        <ProfileFooter isSigningOut={isSigningOut} onLogout={handleLogout} />
      </div>
    </>
  );
}
