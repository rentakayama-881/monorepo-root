import NativeSelect from "@/components/ui/NativeSelect";
import { formatRepoFileKindLabel, formatRepoFileVisibilityLabel } from "@/lib/repoFileLabels";

export default function WorkspaceUploadSection({
  workspaceBootstrapFiles,
  workspaceUploadDraft,
  setWorkspaceUploadDraft,
  workspaceFileInputKey,
  formDisabled,
  processStatusText,
  onFilePicked,
  onAddFile,
  onRemoveFile,
}) {
  return (
    <div id="workspace-files" className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Workspace Files
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Upload file sekarang agar validator bisa langsung kerja. File sensitif otomatis hanya untuk
        validator terpilih.
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Queue saat ini: {workspaceBootstrapFiles.length} file.
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
        <input
          key={workspaceFileInputKey}
          type="file"
          onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
          className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
          disabled={formDisabled}
        />
        <input
          value={workspaceUploadDraft.label}
          onChange={(e) => setWorkspaceUploadDraft((prev) => ({ ...prev, label: e.target.value }))}
          placeholder="Label file (contoh: Draft Skripsi Bab 3)"
          className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
          disabled={formDisabled}
        />
        <NativeSelect
          value={workspaceUploadDraft.kind}
          onChange={(e) =>
            setWorkspaceUploadDraft((prev) => {
              const nextKind = e.target.value;
              return {
                ...prev,
                kind: nextKind,
                visibility:
                  nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
              };
            })
          }
          options={[
            { value: "task_input", label: formatRepoFileKindLabel("task_input") },
            {
              value: "sensitive_context",
              label: formatRepoFileKindLabel("sensitive_context"),
            },
          ]}
          disabled={formDisabled}
        />
        <NativeSelect
          value={workspaceUploadDraft.visibility}
          onChange={(e) =>
            setWorkspaceUploadDraft((prev) => ({ ...prev, visibility: e.target.value }))
          }
          options={[
            { value: "public", label: formatRepoFileVisibilityLabel("public") },
            {
              value: "assigned_validators",
              label: formatRepoFileVisibilityLabel("assigned_validators"),
            },
          ]}
          disabled={formDisabled || workspaceUploadDraft.kind === "sensitive_context"}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddFile}
          disabled={formDisabled}
          className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add File to Queue
        </button>
      </div>
      <div
        className="mt-1 min-h-[18px] truncate text-xs text-muted-foreground"
        title={processStatusText || ""}
      >
        {processStatusText || "\u00A0"}
      </div>

      {workspaceBootstrapFiles.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Visibility</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {workspaceBootstrapFiles.map((item) => (
                <tr key={item.localId} className="border-b border-border/70">
                  <td className="px-3 py-2 text-xs font-semibold text-foreground">
                    {formatRepoFileKindLabel(item.kind)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{item.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatRepoFileVisibilityLabel(item.visibility)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{item.file?.name || "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveFile(item.localId)}
                      disabled={formDisabled}
                      className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">
          Belum ada file di queue. Kamu tetap bisa create case sekarang dan upload nanti di repo
          case.
        </div>
      )}
    </div>
  );
}
