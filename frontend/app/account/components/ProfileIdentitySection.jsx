import AvatarSection from "@/components/account/AvatarSection";
import BadgesSection from "@/components/account/BadgesSection";
import ProfileSection from "@/components/account/ProfileSection";
import UsernameSection from "@/components/account/UsernameSection";

export default function ProfileIdentitySection({
  avatarPreview,
  avatarUrl,
  displayName,
  avatarFile,
  avatarDeleting,
  avatarUploading,
  onAvatarFileChange,
  onDeleteAvatar,
  onUploadAvatar,
  onCancelAvatarPreview,
  badges,
  primaryBadgeId,
  savingBadge,
  onSavePrimaryBadge,
  form,
  setForm,
  socials,
  updateSocial,
  removeSocial,
  addSocial,
  profileDirty,
  profileSaving,
  profileSaveMessage,
  onSaveAccount,
  username,
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-1">Profil &amp; Identitas</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Informasi publik yang terlihat di profil Anda
      </p>
      <div className="rounded-xl border border-border/60 bg-card/80 px-6">
        <AvatarSection
          avatarPreview={avatarPreview}
          avatarUrl={avatarUrl}
          displayName={displayName}
          avatarFile={avatarFile}
          avatarDeleting={avatarDeleting}
          avatarUploading={avatarUploading}
          onAvatarFileChange={onAvatarFileChange}
          onDeleteAvatar={onDeleteAvatar}
          onUploadAvatar={onUploadAvatar}
          onCancelAvatarPreview={onCancelAvatarPreview}
        />

        <BadgesSection
          badges={badges}
          primaryBadgeId={primaryBadgeId}
          savingBadge={savingBadge}
          onSavePrimaryBadge={onSavePrimaryBadge}
        />

        <ProfileSection
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
        />

        <UsernameSection username={username} />
      </div>
    </section>
  );
}
