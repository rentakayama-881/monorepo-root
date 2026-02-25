"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { FEATURE_ENDPOINTS, getFeatureApiBase } from "@/lib/featureApi";
import { useUploadDocument } from "@/lib/useDocuments";

function formatDateTime(ts) {
  if (!ts) return "-";
  const date = new Date(Number(ts) * 1000);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIDR(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "Rp 0";
  return `Rp ${Math.max(0, Math.trunc(n)).toLocaleString("id-ID")}`;
}

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

export default function RepoWorkflowClient({
  embedded = false,
  caseReadmeMarkdown = "",
  caseTitle = "",
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
  const applyDisabled = actionLocked || isAssigned || !stakeEligible;
  const canFinalize = Boolean(repoTree?.can_finalize);
  const payout = repoTree?.payout || null;

  const attachKindOptions = useMemo(() => {
    if (isOwner) {
      return ["task_input", "case_readme", "sensitive_context"];
    }
    return ["validator_output"];
  }, [isOwner]);

  async function getWorkspaceTree() {
    try {
      return await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/workspace/tree`, {
        method: "GET",
        clearSessionOn401: false,
      });
    } catch (err) {
      if (err?.status === 404) {
        return fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/repo/tree`, {
          method: "GET",
          clearSessionOn401: false,
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

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const repoResp = await getWorkspaceTree();
      setRepoTree(repoResp?.repo_tree || null);
    } catch (e) {
      setError(normalizeErr(e, "Gagal memuat repo case"));
      setRepoTree(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) {
      const redirectTarget = `/validation-cases/${encodeURIComponent(id)}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }
    loadAll();
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

  async function runAction(fn, successMsg = "Repo case berhasil diperbarui.") {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await fn();
      await loadAll();
      setMsg(successMsg);
    } catch (e) {
      setError(normalizeErr(e, "Aksi gagal"));
    } finally {
      setBusy(false);
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

      await postWorkspace("files", {
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
    await runAction(async () => {
      await postWorkspace("apply", {});
    }, "Apply validator berhasil dikirim. Menunggu assign owner.");
  }

  async function onAssignValidator(validatorUserID) {
    setAssigningValidatorID(String(validatorUserID));
    await runAction(async () => {
      await postWorkspace("validators/assign", {
        validator_user_ids: [Number(validatorUserID)],
      });
    }, "Validator berhasil diassign.");
    setAssigningValidatorID("");
  }

  async function onVoteConfidence(validatorUserID) {
    setVotingValidatorID(String(validatorUserID));
    await runAction(async () => {
      await postWorkspace("confidence/vote", {
        validator_user_id: Number(validatorUserID),
      });
    }, "Vote confidence berhasil disimpan.");
    setVotingValidatorID("");
  }

  async function onFinalize() {
    await runAction(async () => {
      await postWorkspace("finalize", {});
    }, "Case berhasil difinalisasi dan bounty didistribusikan.");
  }

  if (loading) {
    if (embedded) {
      return (
        <section className="px-1 py-2 text-sm text-muted-foreground">
          Memuat repo case...
        </section>
      );
    }
    return (
      <main className="container py-10">
        <div className="px-1 py-2 text-sm text-muted-foreground">
          Memuat repo case...
        </div>
      </main>
    );
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
                  return (
                    <tr key={file.id}>
                      <td className="py-2 pr-3 font-mono text-xs text-foreground">{file.kind}</td>
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
                        {file.uploaded_by_user?.username ? `@${file.uploaded_by_user.username}` : `#${file.uploaded_by || "-"}`}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{file.visibility}</td>
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
            <select
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
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={actionLocked}
            >
              {attachKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <select
              value={attachForm.visibility}
              onChange={(e) => setAttachForm((prev) => ({ ...prev, visibility: e.target.value }))}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={actionLocked || attachForm.kind === "sensitive_context" || !isOwner}
            >
              <option value="public">public</option>
              <option value="assigned_validators">assigned_validators</option>
            </select>
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
              className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={applyDisabled}
            >
              {isAssigned ? "Anda sudah diassign" : "Apply as Validator"}
            </button>
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
                  const validatorId = Number(item?.validator?.id || 0);
                  const score = confidenceByValidator.get(validatorId);
                  const votes = Number(score?.votes || 0);
                  const viewerVoted = Boolean(score?.viewer_voted);
                  const hasOutput = Boolean(score?.has_uploaded_output);
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
                          disabled={actionLocked || votingValidatorID === String(validatorId)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ConfidenceIcon active={viewerVoted} />
                          {votingValidatorID === String(validatorId) ? "Saving..." : viewerVoted ? "Voted" : "Confidence"}
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
