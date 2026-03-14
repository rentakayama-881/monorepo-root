import { useCallback, useState } from "react";
import { fetchWithAuth } from "@/lib/tokenRefresh";

export function useAccountAvatar({ apiBase, setError, setOk }) {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  const populate = useCallback((data) => {
    setAvatarUrl(data.avatar_url || "");
  }, []);

  const cancelAvatarPreview = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview("");
  }, []);

  const onAvatarFileChange = useCallback(
    (event) => {
      setOk("");
      setError("");

      const file = event.target.files && event.target.files[0];
      if (file) {
        const extension = file.name.toLowerCase().split(".").pop() || "";
        if (!["jpg", "jpeg", "png"].includes(extension)) {
          setError("Format gambar harus JPG atau PNG");
          event.target.value = "";
          return;
        }
      }

      setAvatarFile(file || null);
      if (file) {
        setAvatarPreview(URL.createObjectURL(file));
      } else {
        setAvatarPreview("");
      }
    },
    [setError, setOk]
  );

  async function uploadAvatar() {
    setError("");
    setOk("");
    setAvatarUploading(true);

    try {
      if (!avatarFile) throw new Error("Pilih file gambar terlebih dahulu");

      const formData = new FormData();
      formData.append("file", avatarFile);

      const response = await fetchWithAuth(`${apiBase}/account/avatar`, {
        method: "PUT",
        body: formData,
      });

      const rawText = await response.text();
      if (!response.ok) throw new Error(rawText || "Gagal mengunggah avatar");

      let parsed = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Keep fallback URL.
      }

      const nextUrl = parsed.avatar_url || avatarUrl || "";
      if (nextUrl) setAvatarUrl(nextUrl);
      setOk("Foto profil diperbarui.");
      cancelAvatarPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function deleteAvatar() {
    setError("");
    setOk("");
    setAvatarDeleting(true);

    try {
      const response = await fetchWithAuth(`${apiBase}/account/avatar`, { method: "DELETE" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Gagal menghapus foto profil");
      }

      setAvatarUrl("");
      setOk("Foto profil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarDeleting(false);
    }
  }

  return {
    avatarUrl,
    avatarFile,
    avatarPreview,
    avatarUploading,
    avatarDeleting,
    onAvatarFileChange,
    cancelAvatarPreview,
    uploadAvatar,
    deleteAvatar,
    populate,
  };
}
