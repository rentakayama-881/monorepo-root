"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Alert from "@/components/ui/Alert";
import { CenteredSpinner } from "@/components/ui/LoadingState";
import { useAccountPage } from "./components/useAccountPage";
import Setup2faBanner from "./components/Setup2faBanner";
import ProfileIdentitySection from "./components/ProfileIdentitySection";
import FinanceSection from "./components/FinanceSection";
import IntegrationsSection from "./components/IntegrationsSection";
import SecuritySection from "./components/SecuritySection";

const DeleteAccountSection = dynamic(() => import("@/components/account/DeleteAccountSection"), {
  loading: () => <div className="h-16 animate-pulse bg-border/30 rounded-lg" />,
});

function AccountPageContent() {
  const {
    setup2fa,
    authed,
    loading,
    error,
    ok,
    me,
    username,
    form,
    setForm,
    socials,
    telegramAuth,
    setTelegramAuth,
    avatarUrl,
    avatarFile,
    avatarPreview,
    avatarUploading,
    avatarDeleting,
    onAvatarFileChange,
    onCancelAvatarPreview,
    onUploadAvatar,
    onDeleteAvatar,
    badges,
    primaryBadgeId,
    savingBadge,
    onSavePrimaryBadge,
    profileDirty,
    profileSaving,
    profileSaveMessage,
    onSaveAccount,
    updateSocial,
    addSocial,
    removeSocial,
    guaranteeAmount,
    guaranteeLoading,
    walletBalance,
    releaseGuaranteePin,
    setReleaseGuaranteePin,
    setGuaranteeAmountInput,
    setSetGuaranteeAmountInput,
    setGuaranteePin,
    setSetGuaranteePin,
    guaranteeReleasing,
    guaranteeSubmitting,
    onSubmitSetGuarantee,
    onSubmitReleaseGuarantee,
    passkeySectionRef,
    highlightPasskeySection,
    apiBase,
  } = useAccountPage();

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
      {setup2fa === "true" && <Setup2faBanner />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola pengaturan akun dan preferensi Anda
        </p>
      </div>

      {loading ? (
        <div className="rounded-[var(--radius)] border border-border bg-card p-4">
          <CenteredSpinner className="justify-start" sizeClass="h-5 w-5" />
        </div>
      ) : (
        <div className="space-y-10">
          {error && <Alert variant="error" message={error} />}
          {ok && <Alert variant="success" message={ok} />}

          <ProfileIdentitySection
            avatarPreview={avatarPreview}
            avatarUrl={avatarUrl}
            displayName={username || me?.full_name || me?.email}
            avatarFile={avatarFile}
            avatarDeleting={avatarDeleting}
            avatarUploading={avatarUploading}
            onAvatarFileChange={onAvatarFileChange}
            onDeleteAvatar={onDeleteAvatar}
            onUploadAvatar={onUploadAvatar}
            onCancelAvatarPreview={onCancelAvatarPreview}
            badges={badges}
            primaryBadgeId={primaryBadgeId}
            savingBadge={savingBadge}
            onSavePrimaryBadge={onSavePrimaryBadge}
            form={form}
            setForm={setForm}
            socials={socials}
            updateSocial={updateSocial}
            removeSocial={removeSocial}
            addSocial={addSocial}
            profileDirty={profileDirty}
            profileSaving={profileSaving}
            profileSaveMessage={profileSaveMessage}
            onSaveAccount={onSaveAccount}
            username={username}
          />

          <FinanceSection
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
            onSubmitReleaseGuarantee={onSubmitReleaseGuarantee}
            onSubmitSetGuarantee={onSubmitSetGuarantee}
          />

          <IntegrationsSection telegramAuth={telegramAuth} onTelegramAuthChange={setTelegramAuth} />

          <SecuritySection
            passkeySectionRef={passkeySectionRef}
            highlightPasskeySection={highlightPasskeySection}
          />

          {/* Danger Zone */}
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
