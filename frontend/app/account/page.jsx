"use client";

import dynamic from "next/dynamic";
import Alert from "@/components/ui/Alert";
import PageLayout from "@/components/ui/PageLayout";
import PageHeader from "@/components/ui/PageHeader";
import { useAccountPage } from "./components/useAccountPage";
import Setup2faBanner from "./components/Setup2faBanner";
import ProfileIdentitySection from "./components/ProfileIdentitySection";
import FinanceSection from "./components/FinanceSection";
import IntegrationsSection from "./components/IntegrationsSection";
import SecuritySection from "./components/SecuritySection";

const DeleteAccountSection = dynamic(() => import("@/components/account/DeleteAccountSection"), {
  loading: () => (
    <div className="rounded-[var(--radius)] border border-border bg-card p-6 animate-pulse">
      <div className="h-5 w-32 bg-border rounded mb-3" />
      <div className="h-4 w-48 bg-border rounded" />
    </div>
  ),
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
      <PageLayout maxWidth="narrow">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Anda harus login untuk mengelola akun.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {setup2fa === "true" && <Setup2faBanner />}

      <PageHeader
        title="Pengaturan Akun"
        description="Kelola pengaturan akun dan preferensi Anda"
      />

      {loading ? (
        <div className="space-y-10">
          {/* Profile section skeleton */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-border" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-border rounded" />
                <div className="h-4 w-48 bg-border rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-10 bg-border rounded" />
              <div className="h-10 bg-border rounded" />
            </div>
          </div>
          {/* Finance section skeleton */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-6 animate-pulse">
            <div className="h-5 w-24 bg-border rounded mb-4" />
            <div className="space-y-3">
              <div className="h-10 bg-border rounded" />
              <div className="h-10 bg-border rounded" />
            </div>
          </div>
          {/* Security section skeleton */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-6 animate-pulse">
            <div className="h-5 w-28 bg-border rounded mb-4" />
            <div className="space-y-3">
              <div className="h-10 bg-border rounded" />
            </div>
          </div>
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
    </PageLayout>
  );
}

export default function AccountPage() {
  return <AccountPageContent />;
}
