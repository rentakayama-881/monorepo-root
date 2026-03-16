import Image from "next/image";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Trash2 } from "lucide-react";

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
            <Image
              src={avatarPreview}
              alt="Preview"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border border-border bg-muted/50 object-cover"
              unoptimized
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
                <Trash2 className="w-4 h-4 mr-1" />
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
          <div className="text-xs text-muted-foreground">
            Gunakan gambar rasio 1:1 untuk hasil terbaik. Maks ~2MB.
          </div>
        </div>
      </div>
    </section>
  );
}
