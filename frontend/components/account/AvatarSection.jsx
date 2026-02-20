import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function AvatarSection({
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
}) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Foto Profil</h3>
      <div className="mt-3 flex items-start gap-4">
        <div className="shrink-0">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Preview"
              className="h-16 w-16 rounded-full border border-border bg-muted/50 object-cover"
            />
          ) : (
            <Avatar src={avatarUrl} name={displayName} size="lg" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={onAvatarFileChange}
            label=""
            className="block w-full text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            {avatarUrl && !avatarFile && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onDeleteAvatar}
                disabled={avatarDeleting}
                loading={avatarDeleting}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
                Hapus Foto
              </Button>
            )}
            <Button
              type="button"
              onClick={onUploadAvatar}
              disabled={avatarUploading || !avatarFile}
              loading={avatarUploading}
              size="sm"
            >
              Simpan Foto
            </Button>
            {avatarPreview && (
              <Button type="button" variant="secondary" size="sm" onClick={onCancelAvatarPreview}>
                Batal
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Gunakan gambar rasio 1:1 untuk hasil terbaik. Maks ~2MB.</div>
        </div>
      </div>
    </section>
  );
}
