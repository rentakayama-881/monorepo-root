import { formatRepoFileKindLabel, formatRepoFileVisibilityLabel } from "@/lib/repoFileLabels";
import { formatDateTime } from "@/lib/format";
import { Download } from "lucide-react";

function DownloadIcon() {
  return <Download className="h-3.5 w-3.5" aria-hidden="true" />;
}

export default function RepoFileTable({
  files,
  ownerUserId,
  actionLocked,
  downloadingDocumentID,
  onOpenFile,
}) {
  if (files.length === 0) {
    return <div className="text-sm text-muted-foreground">Belum ada file di repo case.</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm" aria-label="Daftar file repositori">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2 pr-3">Jenis</th>
            <th className="py-2 pr-3">Label</th>
            <th className="py-2 pr-3">Pengunggah</th>
            <th className="py-2 pr-3">Visibilitas</th>
            <th className="py-2 pr-3">Diunggah</th>
            <th className="py-2 pr-3">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {files.map((file) => {
            const documentId = String(file?.document_id || "");
            const processing = downloadingDocumentID === documentId;
            const uploadedBy = Number(file?.uploaded_by || 0);
            const normalizedOwnerUserId = Number(ownerUserId || 0);
            const isOwnerUpload =
              normalizedOwnerUserId > 0 && uploadedBy > 0 && uploadedBy === normalizedOwnerUserId;
            return (
              <tr key={file.id}>
                <td className="py-2 pr-3 text-xs font-semibold text-foreground">
                  {formatRepoFileKindLabel(file.kind)}
                </td>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => onOpenFile(file, { download: false })}
                    disabled={actionLocked || processing}
                    className="text-left font-semibold text-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {file.label}
                  </button>
                </td>
                <td className="py-2 pr-3 text-foreground">
                  {isOwnerUpload
                    ? "Owner case"
                    : file.uploaded_by_user?.username
                      ? `@${file.uploaded_by_user.username}`
                      : `#${file.uploaded_by || "-"}`}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {formatRepoFileVisibilityLabel(file.visibility)}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {formatDateTime(file.uploaded_at)}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {processing ? (
                      <span className="text-xs text-muted-foreground">Opening...</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenFile(file, { download: true })}
                      disabled={actionLocked || processing}
                      aria-label={`Download ${file.label}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-border text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <DownloadIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
