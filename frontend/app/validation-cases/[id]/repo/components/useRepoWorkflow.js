import { useEffect, useMemo, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { FEATURE_ENDPOINTS, getFeatureApiBase } from "@/lib/featureApi";
import { useUploadDocument } from "@/lib/useDocuments";
import {
  normalizeErr,
  parseFilenameFromContentDisposition,
  fallbackDownloadFileName,
  inferMimeTypeFromFilename,
  extractDocumentId,
  legacyWorkspacePath,
  extractRepoTree,
} from "./repoWorkflowUtils";

export function useRepoWorkflow({ id, router }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [repoTree, setRepoTree] = useState(null);

  const [attachForm, setAttachForm] = useState({
    file: null,
    kind: "task_input",
    label: "",
    visibility: "public",
  });
  const [attachFileInputKey, setAttachFileInputKey] = useState(0);

  const [downloadingDocumentID, setDownloadingDocumentID] = useState("");
  const [applyingValidator, setApplyingValidator] = useState(false);
  const [assigningValidatorID, setAssigningValidatorID] = useState("");
  const [votingValidatorID, setVotingValidatorID] = useState("");

  const {
    uploadDocument,
    loading: uploadingDocument,
    progress: uploadProgress,
  } = useUploadDocument();

  const isAuthed = useMemo(() => {
    try {
      return Boolean(getToken());
    } catch {
      return false;
    }
  }, []);

  const isOwner = Boolean(repoTree?.is_owner);
  const isAssigned = Boolean(repoTree?.is_assigned_validator);
  const files = Array.isArray(repoTree?.files) ? repoTree.files : [];
  const applicants = Array.isArray(repoTree?.applicants) ? repoTree.applicants : [];
  const assignments = Array.isArray(repoTree?.assignments) ? repoTree.assignments : [];
  const confidenceScores = Array.isArray(repoTree?.confidence_scores)
    ? repoTree.confidence_scores
    : [];

  const confidenceByValidator = useMemo(() => {
    const out = new Map();
    for (const score of confidenceScores) {
      const key = Number(score?.validator?.id || 0);
      if (!key) continue;
      out.set(key, score);
    }
    return out;
  }, [confidenceScores]);

  const canAttach = isOwner || isAssigned;
  const actionLocked = busy || uploadingDocument;
  const stakeEligible = repoTree != null ? Boolean(repoTree.stake_eligible) : true;
  const applyDisabled =
    !repoTree || actionLocked || applyingValidator || isAssigned || !stakeEligible;
  const canFinalize = Boolean(repoTree?.can_finalize);
  const payout = repoTree?.payout || null;

  const attachKindOptions = useMemo(() => {
    if (isOwner) {
      return ["task_input", "case_readme", "sensitive_context"];
    }
    return ["validator_output"];
  }, [isOwner]);

  function applyRepoTreePayload(payload) {
    const nextTree = extractRepoTree(payload);
    if (!nextTree) return false;
    setRepoTree(nextTree);
    return true;
  }

  async function getWorkspaceTree() {
    return fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/workspace/tree`, {
      method: "GET",
      clearSessionOn401: false,
      timeout: 30000,
    });
  }

  async function postWorkspace(path, payload, requestOptions = {}) {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
      timeout: 30000,
      ...requestOptions,
    };

    try {
      return await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(id)}/workspace/${path}`,
        options
      );
    } catch (err) {
      if (err?.status === 404) {
        return fetchJsonAuth(
          `/api/validation-cases/${encodeURIComponent(id)}/${legacyWorkspacePath(path)}`,
          options
        );
      }
      throw err;
    }
  }

  async function loadAll({ withSkeleton = true } = {}) {
    if (!id) return;
    if (withSkeleton) {
      setLoading(true);
      setError("");
    }
    try {
      const repoResp = await getWorkspaceTree();
      if (!applyRepoTreePayload(repoResp)) {
        setRepoTree(null);
      }
    } catch (e) {
      if (withSkeleton) {
        setError(normalizeErr(e, "Gagal memuat repo case"));
        setRepoTree(null);
      }
    } finally {
      if (withSkeleton) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!isAuthed) {
      const redirectTarget = `/validation-cases/${encodeURIComponent(id)}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }
    loadAll({ withSkeleton: true });
    // Omit loadAll — stable by intent, re-runs on id/auth change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthed]);

  useEffect(() => {
    if (!canAttach) return;
    setAttachForm((prev) => {
      if (attachKindOptions.includes(prev.kind)) {
        if (!isOwner) {
          return {
            ...prev,
            kind: "validator_output",
            visibility: "assigned_validators",
          };
        }
        return prev;
      }
      const nextKind = attachKindOptions[0] || "task_input";
      return {
        ...prev,
        kind: nextKind,
        visibility:
          !isOwner || nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
      };
    });
  }, [attachKindOptions, canAttach, isOwner]);

  async function runAction(
    fn,
    successMsg = "Repo case berhasil diperbarui.",
    options = { lockUI: true, fallbackReload: false }
  ) {
    const lockUI = options?.lockUI !== false;
    const fallbackReload = options?.fallbackReload === true;

    if (lockUI) {
      setBusy(true);
    }
    setError("");
    setMsg("");
    try {
      const result = await fn();
      const applied = applyRepoTreePayload(result);
      if (!applied && fallbackReload) {
        await loadAll({ withSkeleton: false });
      }
      setMsg(successMsg);
    } catch (e) {
      setError(normalizeErr(e, "Aksi gagal"));
    } finally {
      if (lockUI) {
        setBusy(false);
      }
    }
  }

  async function onAttachFile(e) {
    e.preventDefault();

    const file = attachForm.file;
    const label = String(attachForm.label || "").trim();
    if (!file) {
      setError("Pilih file dulu sebelum upload.");
      return;
    }
    if (!label) {
      setError("Label file wajib diisi.");
      return;
    }

    await runAction(async () => {
      const documentVisibility =
        !isOwner || attachForm.kind === "sensitive_context" || attachForm.visibility !== "public"
          ? "private"
          : "public";

      const uploaded = await uploadDocument(file, {
        title: label,
        description: `Validation repo file (${attachForm.kind})`,
        category: "other",
        visibility: documentVisibility,
      });
      const documentId = extractDocumentId(uploaded);
      if (!documentId) {
        throw new Error("Upload berhasil tetapi document_id tidak ditemukan.");
      }

      const updated = await postWorkspace("files", {
        document_id: documentId,
        kind: attachForm.kind,
        label,
        visibility:
          !isOwner || attachForm.kind === "sensitive_context"
            ? "assigned_validators"
            : attachForm.visibility,
      });

      setAttachForm((prev) => ({ ...prev, file: null, label: "" }));
      setAttachFileInputKey((prev) => prev + 1);
      return updated;
    }, "File berhasil ditambahkan ke repo case.");
  }

  async function openWorkspaceFile(file, { download = false } = {}) {
    const documentId = String(file?.document_id || "").trim();
    if (!documentId) {
      setError("Document ID tidak ditemukan.");
      return;
    }

    const token = getToken();
    if (!token) {
      const redirectTarget = `/validation-cases/${encodeURIComponent(id)}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    setDownloadingDocumentID(documentId);
    setError("");
    setMsg("");

    try {
      const endpointPath = download
        ? FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD(encodeURIComponent(documentId))
        : FEATURE_ENDPOINTS.DOCUMENTS.VIEW(encodeURIComponent(documentId));
      const endpoint = `${getFeatureApiBase()}${endpointPath}`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let detail = "";
        try {
          const payload = await res.clone().json();
          detail = String(payload?.error || payload?.message || "").trim();
        } catch {
          detail = "";
        }
        if (res.status === 403) {
          throw new Error(
            "Akses file ditolak. Pastikan owner sudah memberi akses sesuai sensitivity."
          );
        }
        throw new Error(detail || `Gagal membuka file (status ${res.status}).`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      const filename =
        parseFilenameFromContentDisposition(contentDisposition) || fallbackDownloadFileName(file);

      if (download) {
        const objectURL = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectURL;
        anchor.download = filename;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectURL);
        setMsg(`File "${file?.label || documentId}" berhasil diunduh.`);
        return;
      }

      const contentType = String(res.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const inferredType =
        !contentType || contentType === "application/octet-stream"
          ? inferMimeTypeFromFilename(filename)
          : "";

      const previewBlob = inferredType ? blob.slice(0, blob.size, inferredType) : blob;
      const objectURL = window.URL.createObjectURL(previewBlob);

      const win = window.open(objectURL, "_blank", "noopener,noreferrer");
      if (!win) {
        window.location.assign(objectURL);
      }
      window.setTimeout(() => window.URL.revokeObjectURL(objectURL), 60_000);
      setMsg(`File "${file?.label || documentId}" berhasil dibuka.`);
    } catch (e) {
      setError(normalizeErr(e, "Gagal membuka file"));
    } finally {
      setDownloadingDocumentID("");
    }
  }

  async function onApply() {
    setApplyingValidator(true);
    try {
      await runAction(async () => {
        return postWorkspace("apply", {});
      }, "Apply validator berhasil dikirim. Menunggu assign owner.");
    } finally {
      setApplyingValidator(false);
    }
  }

  async function onAssignValidator(validatorUserID) {
    setAssigningValidatorID(String(validatorUserID));
    await runAction(async () => {
      return postWorkspace("validators/assign", {
        validator_user_ids: [Number(validatorUserID)],
      });
    }, "Validator berhasil diassign.");
    setAssigningValidatorID("");
  }

  async function onVoteConfidence(validatorUserID) {
    setVotingValidatorID(String(validatorUserID));
    await runAction(
      async () => {
        return postWorkspace("confidence/vote", {
          validator_user_id: Number(validatorUserID),
        });
      },
      "Vote confidence berhasil disimpan.",
      { lockUI: false, fallbackReload: false }
    );
    setVotingValidatorID("");
  }

  async function onFinalize() {
    await runAction(async () => {
      return postWorkspace("finalize", {});
    }, "Case berhasil difinalisasi dan bounty didistribusikan.");
  }

  return {
    // Loading / feedback
    loading,
    error,
    msg,

    // Core data
    id,
    repoTree,
    isOwner,
    isAssigned,
    files,
    applicants,
    assignments,
    confidenceByValidator,

    // Permissions / flags
    canAttach,
    actionLocked,
    stakeEligible,
    applyDisabled,
    canFinalize,
    payout,

    // Attach form
    attachForm,
    setAttachForm,
    attachFileInputKey,
    attachKindOptions,
    uploadingDocument,
    uploadProgress,

    // Action states
    downloadingDocumentID,
    applyingValidator,
    assigningValidatorID,
    votingValidatorID,

    // Handlers
    loadAll,
    onAttachFile,
    openWorkspaceFile,
    onApply,
    onAssignValidator,
    onVoteConfidence,
    onFinalize,
  };
}
