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
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Workspace Files
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload file agar validator bisa langsung kerja. File sensitif otomatis hanya untuk
          validator terpilih.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
        <input
          key={workspaceFileInputKey}
          type="file"
          onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
          className="rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground"
          disabled={formDisabled}
        />
        <input
          value={workspaceUploadDraft.label}
          onChange={(e) => setWorkspaceUploadDraft((prev) => ({ ...prev, label: e.target.value }))}
          placeholder="Label file (contoh: Draft Skripsi Bab 3)"
          className="rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground"
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddFile}
          disabled={formDisabled}
          className="rounded-[var(--radius)] border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add File to Queue
        </button>
        <span className="text-xs text-muted-foreground">
          {workspaceBootstrapFiles.length} file di queue
        </span>
      </div>
      <div
        className="min-h-[18px] truncate text-xs text-muted-foreground"
        title={processStatusText || ""}
      >
        {processStatusText || "\u00A0"}
      </div>

      {workspaceBootstrapFiles.length > 0 && (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-[var(--radius)] border border-border">
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
                        className="text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="space-y-2 md:hidden">
            {workspaceBootstrapFiles.map((item) => (
              <div
                key={item.localId}
                className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {item.file?.name || "-"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{formatRepoFileKindLabel(item.kind)}</span>
                    <span>{formatRepoFileVisibilityLabel(item.visibility)}</span>
                  </div>
                  {item.label && (
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {item.label}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFile(item.localId)}
                  disabled={formDisabled}
                  className="shrink-0 text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {workspaceBootstrapFiles.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Belum ada file di queue. Kamu tetap bisa create case sekarang dan upload nanti.
        </p>
      )}
    </div>
  );
}
