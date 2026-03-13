import NativeSelect from "@/components/ui/NativeSelect";
import { formatRepoFileKindLabel, formatRepoFileVisibilityLabel } from "@/lib/repoFileLabels";

export default function RepoAttachForm({
  attachForm,
  setAttachForm,
  attachFileInputKey,
  attachKindOptions,
  isOwner,
  actionLocked,
  uploadingDocument,
  uploadProgress,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <input
        key={attachFileInputKey}
        type="file"
        onChange={(e) => setAttachForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
        className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
        required
        disabled={actionLocked}
      />
      <input
        value={attachForm.label}
        onChange={(e) => setAttachForm((prev) => ({ ...prev, label: e.target.value }))}
        placeholder="Label file"
        className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
        required
        disabled={actionLocked}
      />
      <NativeSelect
        value={attachForm.kind}
        onChange={(e) =>
          setAttachForm((prev) => {
            const nextKind = e.target.value;
            return {
              ...prev,
              kind: nextKind,
              visibility:
                nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
            };
          })
        }
        options={attachKindOptions.map((kind) => ({
          value: kind,
          label: formatRepoFileKindLabel(kind),
        }))}
        disabled={actionLocked}
      />
      <NativeSelect
        value={attachForm.visibility}
        onChange={(e) => setAttachForm((prev) => ({ ...prev, visibility: e.target.value }))}
        options={[
          { value: "public", label: formatRepoFileVisibilityLabel("public") },
          {
            value: "assigned_validators",
            label: formatRepoFileVisibilityLabel("assigned_validators"),
          },
        ]}
        disabled={actionLocked || attachForm.kind === "sensitive_context" || !isOwner}
      />
      {uploadingDocument ? (
        <div className="text-xs text-muted-foreground md:col-span-2">
          Uploading file... {uploadProgress}%
        </div>
      ) : null}
      <button
        type="submit"
        className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
        disabled={actionLocked}
      >
        {actionLocked ? "Memproses..." : "Upload File ke Repo"}
      </button>
    </form>
  );
}
