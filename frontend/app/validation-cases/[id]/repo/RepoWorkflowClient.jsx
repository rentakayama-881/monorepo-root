"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";
import Spinner from "@/components/ui/Spinner";
import NativeSelect from "@/components/ui/NativeSelect";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { FEATURE_ENDPOINTS, getFeatureApiBase } from "@/lib/featureApi";
import { useUploadDocument } from "@/lib/useDocuments";
import { formatIDR, formatDateTime } from "@/lib/format";
import { formatRepoFileKindLabel, formatRepoFileVisibilityLabel } from "@/lib/repoFileLabels";

function normalizeErr(err, fallback) {
  const message = String(err?.message || fallback || "Terjadi kesalahan").trim();
  const details = String(err?.details || "").trim();
  if (!details) return message;
  return `${message}: ${details}`;
}

function parseFilenameFromContentDisposition(contentDisposition) {
  const raw = String(contentDisposition || "").trim();
  if (!raw) return "";
  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return String(utf8Match[1]).trim();
    }
  }
  const asciiMatch = raw.match(/filename="?([^"]+)"?/i);
  if (asciiMatch?.[1]) return String(asciiMatch[1]).trim();
  return "";
}

function fallbackDownloadFileName(file) {
  const label = String(file?.label || "").trim();
  const documentId = String(file?.document_id || "").trim();
  const safeLabel = label.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  if (safeLabel) return safeLabel;
  if (documentId) return `workspace-file-${documentId}`;
  return "workspace-file";
}

function fileExtensionFromName(name) {
  const value = String(name || "").trim().toLowerCase();
  if (!value) return "";
  const idx = value.lastIndexOf(".");
  if (idx <= 0 || idx >= value.length - 1) return "";
  return value.slice(idx + 1);
}

function inferMimeTypeFromFilename(name) {
  const ext = fileExtensionFromName(name);
  if (!ext) return "";

  const map = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    xml: "application/xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };

  return map[ext] || "";
}

function extractDocumentId(uploadResult) {
  if (!uploadResult || typeof uploadResult !== "object") return "";
  const candidates = [
    uploadResult.document_id,
    uploadResult.documentId,
    uploadResult.id,
    uploadResult.DocumentId,
    uploadResult.DocumentID,
    uploadResult.ID,
    uploadResult?.data?.document_id,
    uploadResult?.data?.documentId,
    uploadResult?.data?.id,
    uploadResult?.data?.DocumentId,
    uploadResult?.data?.DocumentID,
    uploadResult?.data?.ID,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
}

function legacyWorkspacePath(path) {
  switch (path) {
    case "files":
      return "repo/files";
    case "validators/assign":
      return "validators/assign";
    case "confidence/vote":
      return "confidence/vote";
    case "finalize":
      return "finalize";
    default:
      return path;
  }
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M12 3v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 11 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ConfidenceIcon({ active = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${active ? "text-emerald-600" : "text-muted-foreground"}`} aria-hidden="true">
      <path d="m12 3 7 3v5c0 4.3-2.6 8.4-7 10-4.4-1.6-7-5.7-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m9.2 12 1.9 1.9 3.7-3.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RepoWorkspaceSkeleton({ embedded = false, caseTitle = "" }) {
  const skeletonContent = (
    <div className="space-y-7" aria-busy="true" aria-live="polite">
      <section className="space-y-4">
        <SkeletonText width="w-40" height="h-3.5" />
        <div className="rounded-2xl bg-secondary/20 px-4 py-4">
          <div className="mb-3 hidden gap-3 pb-3 md:grid md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`repo-head-${i}`} className="h-4 w-20" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, row) => (
              <div key={`repo-row-${row}`} className="rounded-xl bg-card/60 p-3 md:rounded-none md:bg-transparent md:p-0">
                <div className="space-y-2 md:hidden">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
                <div className="hidden gap-3 md:grid md:grid-cols-6">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <Skeleton key={`repo-cell-${row}-${col}`} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SkeletonText width="w-36" height="h-3.5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-2xl bg-secondary/20 px-4 py-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="space-y-2 rounded-2xl bg-secondary/20 px-4 py-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SkeletonText width="w-24" height="h-3.5" />
        <Skeleton className="h-5 w-full rounded-lg" />
        <Skeleton className="h-5 w-4/5 rounded-lg" />
        <Skeleton className="h-5 w-3/5 rounded-lg" />
      </section>
    </div>
  );

  if (embedded) {
    return <section className="min-h-[62vh] py-1">{skeletonContent}</section>;
  }

  return (
    <main className="container min-h-screen py-10 space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-36" />
        <span>/</span>
        <Skeleton className="h-4 w-20" />
        <span>/</span>
        <Skeleton className="h-4 w-12" />
      </nav>
      {caseTitle ? <h1 className="text-2xl font-semibold text-foreground">{caseTitle}</h1> : <Skeleton className="h-8 w-72" />}
      {skeletonContent}
    </main>
  );
}

export default function RepoWorkflowClient({
  embedded = false,
  caseReadmeMarkdown = "",
  caseTitle = "",
  ownerUserId = 0,
  viewerUserId = 0,
}) {
  const params = useParams();
  const router = useRouter();
  const id = useMemo(() => String(params?.id || ""), [params?.id]);

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

  const { uploadDocument, loading: uploadingDocument, progress: uploadProgress } = useUploadDocument();

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
  const confidenceScores = Array.isArray(repoTree?.confidence_scores) ? repoTree.confidence_scores : [];

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
  const stakeEligible = Boolean(repoTree?.stake_eligible);
  const applyDisabled = actionLocked || applyingValidator || isAssigned || !stakeEligible;
  const canFinalize = Boolean(repoTree?.can_finalize);
  const payout = repoTree?.payout || null;

  const attachKindOptions = useMemo(() => {
    if (isOwner) {
      return ["task_input", "case_readme", "sensitive_context"];
    }
    return ["validator_output"];
  }, [isOwner]);

  function extractRepoTree(payload) {
    if (payload && typeof payload === "object") {
      if (payload.repo_tree && typeof payload.repo_tree === "object") {
        return payload.repo_tree;
      }
      if (payload.case_id && payload.files) {
        return payload;
      }
    }
    return null;
  }

  function applyRepoTreePayload(payload) {
    const nextTree = extractRepoTree(payload);
    if (!nextTree) return false;
    setRepoTree(nextTree);
    return true;
  }

  async function getWorkspaceTree() {
    try {
      return await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/workspace/tree`, {
        method: "GET",
        clearSessionOn401: false,
        timeout: 20000,
      });
    } catch (err) {
      if (err?.status === 404) {
        return fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/repo/tree`, {
          method: "GET",
          clearSessionOn401: false,
          timeout: 20000,
        });
      }
      throw err;
    }
  }

  async function postWorkspace(path, payload, requestOptions = {}) {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
      timeout: 20000,
      ...requestOptions,
    };

    try {
      return await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/workspace/${path}`, options);
    } catch (err) {
      if (err?.status === 404) {
        return fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/${legacyWorkspacePath(path)}`, options);
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
        visibility: !isOwner || nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
      };
    });
  }, [attachKindOptions, canAttach, isOwner]);

  async function runAction(
    fn,
    successMsg = "Repo case berhasil diperbarui.",
    options = { lockUI: true, fallbackReload: false },
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
          throw new Error("Akses file ditolak. Pastikan owner sudah memberi akses sesuai sensitivity.");
        }
        throw new Error(detail || `Gagal membuka file (status ${res.status}).`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      const filename = parseFilenameFromContentDisposition(contentDisposition) || fallbackDownloadFileName(file);

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
        setMsg(`File \"${file?.label || documentId}\" berhasil diunduh.`);
        return;
      }

      const contentType = String(res.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const inferredType = !contentType || contentType === "application/octet-stream"
        ? inferMimeTypeFromFilename(filename)
        : "";
      const previewBlob = inferredType
        ? blob.slice(0, blob.size, inferredType)
        : blob;
      const objectURL = window.URL.createObjectURL(previewBlob);

      const win = window.open(objectURL, "_blank", "noopener,noreferrer");
      if (!win) {
        window.location.assign(objectURL);
      }
      window.setTimeout(() => window.URL.revokeObjectURL(objectURL), 60_000);
      setMsg(`File \"${file?.label || documentId}\" berhasil dibuka.`);
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
    await runAction(async () => {
      return postWorkspace("confidence/vote", {
        validator_user_id: Number(validatorUserID),
      });
    }, "Vote confidence berhasil disimpan.", { lockUI: false, fallbackReload: false });
    setVotingValidatorID("");
  }

  async function onFinalize() {
    await runAction(async () => {
      return postWorkspace("finalize", {});
    }, "Case berhasil difinalisasi dan bounty didistribusikan.");
  }

  if (loading) {
    return <RepoWorkspaceSkeleton embedded={embedded} caseTitle={caseTitle} />;
  }

  const content = (
    <div className="space-y-7">
      {error ? (
        <div role="alert" aria-live="polite" className="rounded-[var(--radius)] bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      {msg ? (
        <div role="status" aria-live="polite" className="rounded-[var(--radius)] bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Repo Files</h2>
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">Belum ada file di repo case.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Uploader</th>
                  <th className="py-2 pr-3">Visibility</th>
                  <th className="py-2 pr-3">Uploaded</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {files.map((file) => {
                  const documentId = String(file?.document_id || "");
                  const processing = downloadingDocumentID === documentId;
                  const uploadedBy = Number(file?.uploaded_by || 0);
                  const normalizedOwnerUserId = Number(ownerUserId || 0);
                  const isOwnerUpload = normalizedOwnerUserId > 0 && uploadedBy > 0 && uploadedBy === normalizedOwnerUserId;
                  return (
                    <tr key={file.id}>
                      <td className="py-2 pr-3 text-xs font-semibold text-foreground">{formatRepoFileKindLabel(file.kind)}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => openWorkspaceFile(file, { download: false })}
                          disabled={actionLocked || processing}
                          className="text-left font-semibold text-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {file.label}
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-foreground">
                        {isOwnerUpload ? "Owner case" : file.uploaded_by_user?.username ? `@${file.uploaded_by_user.username}` : `#${file.uploaded_by || "-"}`}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{formatRepoFileVisibilityLabel(file.visibility)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{formatDateTime(file.uploaded_at)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          {processing ? <span className="text-xs text-muted-foreground">Opening...</span> : null}
                          <button
                            type="button"
                            onClick={() => openWorkspaceFile(file, { download: true })}
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
        )}

        {canAttach ? (
          <form onSubmit={onAttachFile} className="grid gap-3 md:grid-cols-2">
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
                    visibility: nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
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
              <div className="text-xs text-muted-foreground md:col-span-2">Uploading file... {uploadProgress}%</div>
            ) : null}
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={actionLocked}
            >
              {actionLocked ? "Memproses..." : "Upload File ke Repo"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Validators</h2>

        {!isOwner ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onApply}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={applyDisabled}
              aria-live="polite"
            >
              {applyingValidator ? (
                <>
                  <Spinner className="h-3.5 w-3.5 border-border border-t-foreground" />
                  <span>Mengirim apply...</span>
                </>
              ) : isAssigned ? (
                "Anda sudah diassign"
              ) : (
                "Apply as Validator"
              )}
            </button>
            {applyingValidator ? (
              <div className="text-xs text-primary">Request apply sedang diproses...</div>
            ) : null}
            {!stakeEligible ? (
              <div className="text-xs text-amber-700">
                Stake kamu belum memenuhi syarat untuk apply case ini.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Owner melakukan assign validator manual dari daftar applicant.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Applicants</div>
            {applicants.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Belum ada applicant.</div>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {applicants.map((it) => (
                  <li key={`app-${it.id}`} className="flex items-center justify-between gap-2">
                    <span className="text-foreground">#{it.id} {it.username ? `@${it.username}` : ""}</span>
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => onAssignValidator(it.id)}
                        disabled={actionLocked || assigningValidatorID === String(it.id)}
                        className="rounded-[var(--radius)] border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {assigningValidatorID === String(it.id) ? "Assigning..." : "Assign"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground">Assigned Validators</div>
            {assignments.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Belum ada validator yang diassign.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {assignments.map((item) => {
                  const validatorId = Number(item?.validator?.id || item?.validator_user_id || 0);
                  const score = confidenceByValidator.get(validatorId);
                  const votes = Number(score?.votes || 0);
                  const viewerVoted = Boolean(score?.viewer_voted);
                  const hasOutput = Boolean(score?.has_uploaded_output);
                  const isSelfTarget = viewerUserId > 0 && validatorId > 0 && Number(viewerUserId) === validatorId;
                  return (
                    <li key={`as-${validatorId}`} className="py-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-foreground">#{validatorId} {item?.validator?.username ? `@${item.validator.username}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(item?.assigned_at)}</div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>status: {item?.status || "-"}</span>
                        <span>uploaded: {hasOutput ? "yes" : "no"}</span>
                        <span>confidence votes: {votes}</span>
                      </div>
                      {!isOwner ? (
                        <button
                          type="button"
                          onClick={() => onVoteConfidence(validatorId)}
                          disabled={Boolean(votingValidatorID) || validatorId <= 0 || isSelfTarget}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ConfidenceIcon active={viewerVoted} />
                          {validatorId <= 0
                            ? "Unavailable"
                            : isSelfTarget
                              ? "Self"
                              : votingValidatorID === String(validatorId)
                                ? "Saving..."
                                : viewerVoted
                                  ? "Voted"
                                  : "Confidence"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {isOwner ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Finalisasi Case</h2>
          <div className="text-sm text-muted-foreground">
            Finalisasi membutuhkan minimal <span className="font-semibold text-foreground">{repoTree?.minimum_validator_uploads || 3}</span> validator upload hasil.
          </div>
          <div className="text-sm text-muted-foreground">
            Progress saat ini: <span className="font-semibold text-foreground">{repoTree?.uploaded_validator_count || 0}</span> validator upload.
          </div>
          <button
            type="button"
            onClick={onFinalize}
            disabled={actionLocked || !canFinalize}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLocked ? "Memproses..." : "Finalize Case"}
          </button>
        </section>
      ) : null}

      {payout ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Payout Result</h2>
          <div className="text-sm text-muted-foreground">Total bounty: {formatIDR(payout?.bounty_amount || 0)}</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3">Validator</th>
                  <th className="py-2 pr-3">Confidence Votes</th>
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(payout?.entries || []).map((entry) => (
                  <tr key={`pay-${entry.validator_user_id}`}>
                    <td className="py-2 pr-3 text-foreground">#{entry.validator_user_id}</td>
                    <td className="py-2 pr-3 text-foreground">{entry.confidence_votes || 0}</td>
                    <td className="py-2 pr-3 font-semibold text-foreground">{formatIDR(entry.amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">README</h2>
        <div className="mt-2">
          {String(caseReadmeMarkdown || "").trim() ? (
            <div className="prose prose-neutral max-w-none">
              <MarkdownPreview content={caseReadmeMarkdown} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">README belum tersedia.</div>
          )}
        </div>
      </section>
    </div>
  );

  if (embedded) {
    return <section className="space-y-6">{content}</section>;
  }

  return (
    <main className="container py-10 space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/validation-cases" className="hover:underline" prefetch={false}>
          Validation Case Index
        </Link>
        <span>/</span>
        <Link href={`/validation-cases/${encodeURIComponent(id)}`} className="hover:underline" prefetch={false}>
          Case #{id}
        </Link>
        <span>/</span>
        <span className="text-foreground">Repo</span>
      </nav>
      {caseTitle ? <h1 className="text-2xl font-semibold text-foreground">{caseTitle}</h1> : null}
      {content}
    </main>
  );
}
