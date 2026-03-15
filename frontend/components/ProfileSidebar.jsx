"use client";
import Skeleton, { SkeletonCircle, SkeletonText } from "@/components/ui/Skeleton";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileStats from "@/components/profile/ProfileStats";
import ProfileNav from "@/components/profile/ProfileNav";
import ProfileFooter from "@/components/profile/ProfileFooter";
import useProfileSidebar from "@/components/profile/useProfileSidebar";

const overlayClassName = "fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300";
const panelClassName =
  "fixed right-1 top-[calc(var(--header-height)+0.25rem)] z-[110] w-64 max-w-[calc(100vw-0.5rem)] flex flex-col max-h-[calc(100dvh-var(--header-height)-0.75rem)] animate-slide-in-from-right";

function TreeSkeletonNode() {
  return (
    <div className="tree-node">
      <Skeleton className="h-7 w-full rounded-lg bg-muted-foreground/15 dark:bg-secondary" />
    </div>
  );
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
          <div className="tree-sidebar">
            <div className="tree-node">
              <div className="rainbow-card-glass px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{loadError}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Coba Lagi
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                  >
                    Tutup
                  </button>
                </div>
              </div>
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
          <div className="tree-sidebar" aria-busy="true" aria-live="polite">
            <div className="tree-node">
              <div className="rainbow-card-glass px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <SkeletonCircle
                    size="h-7 w-7"
                    className="bg-muted-foreground/15 dark:bg-secondary"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <SkeletonText
                      width="w-20"
                      className="bg-muted-foreground/15 dark:bg-secondary"
                    />
                    <SkeletonText
                      width="w-28"
                      height="h-2.5"
                      className="bg-muted-foreground/15 dark:bg-secondary"
                    />
                  </div>
                </div>
              </div>
            </div>
            <TreeSkeletonNode />
            <TreeSkeletonNode />
            <TreeSkeletonNode />
            <TreeSkeletonNode />
            <div className="tree-node">
              <Skeleton className="h-7 w-full rounded-lg bg-muted-foreground/15 dark:bg-secondary" />
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
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-label="Account panel"
        tabIndex={-1}
        onClickCapture={handlePanelNavigation}
      >
        <div
          className="tree-sidebar flex-1 overflow-y-auto scrollbar-thin"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Profile Card — first node */}
          <div className="tree-node">
            <ProfileCard user={user} displayName={displayName} onClose={onClose} />
          </div>

          {/* Wallet group */}
          <div className="tree-group">
            <div className="tree-group-label">Wallet</div>
            <div className="tree-subtree">
              <div className="tree-node">
                <ProfileStats wallet={wallet} guarantee={guarantee} />
              </div>
              <ProfileNav pathname={pathname} section="wallet" />
            </div>
          </div>

          {/* Account group */}
          <div className="tree-group">
            <div className="tree-group-label">Akun</div>
            <div className="tree-subtree">
              <ProfileNav pathname={pathname} section="account" />
            </div>
          </div>

          {/* Sign Out — last node */}
          <div className="tree-node">
            <ProfileFooter isSigningOut={isSigningOut} onLogout={handleLogout} />
          </div>
        </div>
      </div>
    </>
  );
}
