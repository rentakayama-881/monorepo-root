import { useState } from "react";

const INITIAL_DRAFT = {
  file: null,
  kind: "task_input",
  label: "",
  visibility: "public",
};

export function useWorkspaceFiles() {
  const [workspaceUploadDraft, setWorkspaceUploadDraft] = useState(INITIAL_DRAFT);
  const [workspaceBootstrapFiles, setWorkspaceBootstrapFiles] = useState([]);
  const [workspaceFileInputKey, setWorkspaceFileInputKey] = useState(0);

  function onWorkspaceFilePicked(file) {
    if (!file) {
      setWorkspaceUploadDraft((prev) => ({ ...prev, file: null }));
      return;
    }
    const fallbackLabel = String(file.name || "")
      .trim()
      .replace(/\.[^/.]+$/, "");
    setWorkspaceUploadDraft((prev) => ({
      ...prev,
      file,
      label: String(prev.label || "").trim() || fallbackLabel || "Case file",
    }));
  }

  function addWorkspaceBootstrapFile() {
    const file = workspaceUploadDraft.file;
    if (!file) {
      return "Pilih file dulu sebelum menambahkan ke daftar upload.";
    }

    const kind = String(workspaceUploadDraft.kind || "task_input").trim();
    const label = String(workspaceUploadDraft.label || "").trim();
    const visibility =
      kind === "sensitive_context"
        ? "assigned_validators"
        : String(workspaceUploadDraft.visibility || "public").trim();

    if (!label) {
      return "Label file wajib diisi.";
    }

    setWorkspaceBootstrapFiles((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        file,
        kind,
        label,
        visibility,
      },
    ]);
    setWorkspaceUploadDraft(INITIAL_DRAFT);
    setWorkspaceFileInputKey((prev) => prev + 1);
    return null;
  }

  function removeWorkspaceBootstrapFile(localId) {
    setWorkspaceBootstrapFiles((prev) => prev.filter((item) => item.localId !== localId));
  }

  return {
    workspaceUploadDraft,
    setWorkspaceUploadDraft,
    workspaceBootstrapFiles,
    workspaceFileInputKey,
    onWorkspaceFilePicked,
    addWorkspaceBootstrapFile,
    removeWorkspaceBootstrapFile,
  };
}
