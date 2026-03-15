"use client";
import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileStats from "@/components/profile/ProfileStats";
import ProfileNav from "@/components/profile/ProfileNav";
import ProfileFooter from "@/components/profile/ProfileFooter";
import useProfileSidebar from "@/components/profile/useProfileSidebar";

const overlayClassName = "fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300";
const panelClassName =
  "fixed right-1.5 top-[calc(var(--header-height)+0.25rem)] z-[110] w-64 max-w-[calc(100vw-0.75rem)] overflow-hidden rounded-xl border-x border-b border-border/60 bg-card shadow-lg flex flex-col max-h-[calc(100dvh-var(--header-height)-0.75rem)] animate-slide-in-from-right";

function SkeletonItem() {
  return <Skeleton className="mx-2 h-7 rounded-md bg-secondary" />;
}

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
          className={panelClassName}
          role="dialog"
          aria-modal="true"
          aria-label="Account panel"
          tabIndex={-1}
        >
          {/* Rainbow accent bar */}
          <div className="rainbow-line-h shrink-0" />
          <div className="p-3">
            <p className="text-xs text-muted-foreground">{loadError}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
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
          className={panelClassName}
          role="dialog"
          aria-modal="true"
          aria-label="Account panel"
          tabIndex={-1}
        >
          {/* Rainbow accent bar */}
          <div className="rainbow-line-h shrink-0" />
          <div className="space-y-3 p-3" aria-busy="true" aria-live="polite">
            {/* Profile skeleton */}
            <div className="flex items-center gap-2.5">
              <SkeletonCircle size="h-8 w-8" className="bg-secondary" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonText width="w-24" className="bg-secondary" />
                <SkeletonText width="w-32" height="h-2.5" className="bg-secondary" />
              </div>
            </div>
            {/* Balance skeleton */}
            <Skeleton className="h-10 w-full rounded-md bg-secondary" />
            <div className="border-t border-border/50" />
            {/* Items skeleton */}
            <div className="space-y-1">
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </div>
            <div className="border-t border-border/50" />
            <div className="space-y-1">
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </div>
            <div className="border-t border-border/50" />
            <SkeletonItem />
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
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-label="Account panel"
        tabIndex={-1}
        onClickCapture={handlePanelNavigation}
      >
        {/* Rainbow accent bar at top */}
        <div className="rainbow-line-h shrink-0" />

        {/* Profile header */}
        <ProfileCard user={user} displayName={displayName} onClose={onClose} />

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Wallet section */}
          <div className="px-1.5 pb-1.5">
            <ProfileStats wallet={wallet} guarantee={guarantee} />
            <div className="mt-0.5 px-1 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Wallet
            </div>
            <ProfileNav pathname={pathname} section="wallet" />
          </div>

          <div className="mx-2 border-t border-border/50" />

          {/* Account section */}
          <div className="px-1.5 py-1.5">
            <div className="px-1 pb-0.5 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Account
            </div>
            <ProfileNav pathname={pathname} section="account" />
          </div>

          <div className="mx-2 border-t border-border/50" />

          {/* Sign out */}
          <div className="p-1.5">
            <ProfileFooter isSigningOut={isSigningOut} onLogout={handleLogout} />
          </div>
        </div>
      </div>
    </>
  );
}
