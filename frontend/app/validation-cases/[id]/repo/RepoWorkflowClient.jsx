"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
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

function formatCompletionModeLabel(rawMode) {
  const mode = String(rawMode || "").trim().toLowerCase();
  if (mode === "panel_10") return "Panel 10 (escalated)";
  if (mode === "panel_3") return "Panel 3 (default)";
  return rawMode || "-";
}

function formatWorkspaceStageLabel(rawStage) {
  const stage = String(rawStage || "").trim().toLowerCase();
  if (!stage) return "-";
  const map = {
    draft: "Draft",
    published: "Published",
    paneling: "Paneling",
    reviewing: "Reviewing",
    consensus_reached: "Consensus Reached",
    completed: "Completed",
  };
  return map[stage] || stage.replace(/_/g, " ");
}

function normalizeErr(err, fallback) {
  const message = String(err?.message || fallback || "Terjadi kesalahan").trim();
  const details = String(err?.details || "").trim();
  if (!details) return message;
  return `${message}: ${details}`;
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
    default:
      return path;
  }
}

export default function WorkspaceWorkflowClient() {
  const params = useParams();
  const router = useRouter();
  const id = useMemo(() => String(params?.id || ""), [params?.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repoTree, setRepoTree] = useState(null);
  const [consensus, setConsensus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [attachForm, setAttachForm] = useState({
    file: null,
    kind: "task_input",
    label: "",
    visibility: "public",
  });
  const [attachFileInputKey, setAttachFileInputKey] = useState(0);
  const [assignForm, setAssignForm] = useState({ panel_size: 3 });
  const [verdictForm, setVerdictForm] = useState({
    verdict: "valid",
    confidence: 80,
    notes: "",
    attachmentFile: null,
  });
  const [verdictFileInputKey, setVerdictFileInputKey] = useState(0);

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
  const canAttach = isOwner || isAssigned;
  const applicants = Array.isArray(repoTree?.applicants) ? repoTree.applicants : [];
  const assignments = Array.isArray(repoTree?.assignments) ? repoTree.assignments : [];
  const files = Array.isArray(repoTree?.files) ? repoTree.files : [];
  const verdicts = Array.isArray(repoTree?.verdicts) ? repoTree.verdicts : [];
  const requiredStake = Number(repoTree?.required_stake || 0);
  const viewerStake = Number(repoTree?.viewer_stake || 0);
  const stakeEligible = Boolean(repoTree?.stake_eligible);
  const completionMode = String(repoTree?.completion_mode || "panel_3").trim().toLowerCase();
  const requiredVotesFromMode = completionMode === "panel_10" ? 10 : 3;
  const requiredVotes = Number(consensus?.required_votes || requiredVotesFromMode);
  const submittedVotes = Number(consensus?.submitted_votes || verdicts.length || 0);
  const hasRequiredReadme = Boolean(repoTree?.has_required_readme);
  const hasTaskInput = Boolean(repoTree?.has_task_input);
  const workspaceStageRaw = String(repoTree?.workspace_stage || repoTree?.repo_stage || "draft").trim().toLowerCase();
  const workspacePublished = workspaceStageRaw !== "draft";
  const assignmentsReady = assignments.length >= requiredVotes;
  const votesReady = submittedVotes >= requiredVotes;
  const readinessSteps = useMemo(
    () => [
      { key: "readme", label: "README tersedia", done: hasRequiredReadme },
      { key: "task-input", label: "Task input tersedia", done: hasTaskInput },
      { key: "published", label: "Workspace dipublish", done: workspacePublished },
      { key: "panel", label: `Panel terassign (${requiredVotes})`, done: assignmentsReady },
      { key: "votes", label: `Verdict masuk (${requiredVotes})`, done: votesReady },
    ],
    [hasRequiredReadme, hasTaskInput, workspacePublished, requiredVotes, assignmentsReady, votesReady],
  );
  const readinessDone = readinessSteps.filter((item) => item.done).length;
  const readinessPercent = Math.round((readinessDone / readinessSteps.length) * 100);
  const nextActionHint = useMemo(() => {
    if (isOwner) {
      if (!hasRequiredReadme || !hasTaskInput) {
        return "Lengkapi README dan task input agar workspace bisa dipublish.";
      }
      if (!workspacePublished) {
        return "Publish workspace supaya validator bisa apply.";
      }
      if (!assignmentsReady) {
        return "Jalankan auto-match untuk mengunci panel validator.";
      }
      if (!votesReady) {
        return "Pantau verdict hingga kuota suara terpenuhi.";
      }
      return "Consensus sudah siap. Review hasil dan payout ledger.";
    }
    if (isAssigned) {
      return "Kamu sudah terassign. Upload output + submit verdict secepatnya.";
    }
    if (!stakeEligible) {
      return "Stake belum memenuhi syarat. Top up stake untuk bisa apply.";
    }
    return "Apply as validator jika konteks case sesuai keahlianmu.";
  }, [isOwner, isAssigned, hasRequiredReadme, hasTaskInput, workspacePublished, assignmentsReady, votesReady, stakeEligible]);
  const actionLocked = busy || uploadingDocument;
  const applyDisabled = actionLocked || isAssigned || !stakeEligible;
  const attachKindOptions = useMemo(
    () => (isOwner ? ["task_input", "case_readme", "sensitive_context"] : ["validator_output"]),
    [isOwner]
  );
  const sensitiveKindSelected = attachForm.kind === "sensitive_context";

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

  async function getWorkspaceConsensus() {
    try {
      return await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/workspace/consensus`, {
        method: "GET",
        clearSessionOn401: false,
      });
    } catch (err) {
      if (err?.status === 404) {
        return fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/consensus`, {
          method: "GET",
          clearSessionOn401: false,
        });
      }
      throw err;
    }
  }

  async function postWorkspace(path, payload) {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
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

  async function loadAll(options = {}) {
    const showPageLoader = options.showPageLoader !== false;
    let success = true;
    if (!id) return false;
    if (showPageLoader) {
      setLoading(true);
    }
    setError("");
    try {
      const [repoResp, consensusResp] = await Promise.all([getWorkspaceTree(), getWorkspaceConsensus()]);
      setRepoTree(repoResp?.repo_tree || null);
      setConsensus(consensusResp?.consensus || null);
    } catch (e) {
      success = false;
      setError(normalizeErr(e, "Gagal memuat Evidence Validation Workspace"));
      setRepoTree(null);
      setConsensus(null);
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
    return success;
  }

  useEffect(() => {
    if (!isAuthed) {
      router.push(`/login?redirect=/validation-cases/${encodeURIComponent(id)}/workspace`);
      return;
    }
    loadAll({ showPageLoader: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthed]);

  useEffect(() => {
    if (!canAttach) return;
    setAttachForm((prev) => {
      if (attachKindOptions.includes(prev.kind)) {
        return prev;
      }
      const nextKind = attachKindOptions[0] || "task_input";
      return {
        ...prev,
        kind: nextKind,
        visibility: nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
      };
    });
  }, [attachKindOptions, canAttach]);

  async function runAction(fn) {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await fn();
      await loadAll({ showPageLoader: false });
      setMsg("Workspace berhasil diperbarui.");
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
      const uploaded = await uploadDocument(file, {
        title: label,
        description: `Validation workspace file (${attachForm.kind})`,
        category: "other",
        visibility: "private",
      });
      const documentId = extractDocumentId(uploaded);
      if (!documentId) {
        throw new Error("Upload berhasil tetapi document_id tidak ditemukan.");
      }

      await postWorkspace("files", {
        document_id: documentId,
        kind: attachForm.kind,
        label,
        visibility: attachForm.kind === "sensitive_context" ? "assigned_validators" : attachForm.visibility,
      });

      setAttachForm((prev) => ({
        ...prev,
        file: null,
        label: "",
      }));
      setAttachFileInputKey((prev) => prev + 1);
    });
  }

  async function onPublish() {
    await runAction(async () => {
      await postWorkspace("publish", {});
    });
  }

  async function onApply() {
    await runAction(async () => {
      await postWorkspace("apply", {});
    });
  }

  async function onAutoAssign(e) {
    e.preventDefault();
    const panelSize = Number(assignForm.panel_size) === 10 ? 10 : 3;
    await runAction(async () => {
      await postWorkspace("validators/auto-assign", {
        panel_size: panelSize,
      });
    });
  }

  async function onRefreshWorkspace() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const refreshed = await loadAll({ showPageLoader: false });
      if (refreshed) {
        setMsg("Snapshot workspace diperbarui.");
      } else {
        setError("Snapshot workspace belum bisa diperbarui.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitVerdict(e) {
    e.preventDefault();

    await runAction(async () => {
      let documentId = "";
      if (verdictForm.attachmentFile) {
        const uploaded = await uploadDocument(verdictForm.attachmentFile, {
          title: `Verdict attachment case #${id}`,
          description: `Validator verdict attachment (${verdictForm.verdict})`,
          category: "other",
          visibility: "private",
        });
        documentId = extractDocumentId(uploaded);
        if (!documentId) {
          throw new Error("Upload verdict attachment berhasil, tetapi document_id tidak ditemukan.");
        }
      }

      await postWorkspace("verdicts", {
        verdict: verdictForm.verdict,
        confidence: Number(verdictForm.confidence),
        notes: verdictForm.notes,
        document_id: documentId,
      });

      setVerdictForm((prev) => ({
        ...prev,
        notes: "",
        attachmentFile: null,
      }));
      setVerdictFileInputKey((prev) => prev + 1);
    });
  }

  if (loading) {
    return (
      <main className="container py-10">
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          Memuat Evidence Validation Workspace...
        </div>
      </main>
    );
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
        <span className="text-foreground">Evidence Validation Workspace</span>
      </nav>

      {error ? (
        <div role="alert" aria-live="polite" className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}
      {msg ? (
        <div role="status" aria-live="polite" className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</div>
      ) : null}

      <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-3">
        <h1 className="text-xl font-semibold text-foreground">{repoTree?.workflow_name || "Evidence Validation Workspace"}</h1>
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <div>
            Workflow: <span className="font-semibold text-foreground">{repoTree?.workflow_family || "-"}</span>
          </div>
          <div>
            Stage: <span className="font-semibold text-foreground">{formatWorkspaceStageLabel(repoTree?.workspace_stage || repoTree?.repo_stage || "-")}</span>
          </div>
          <div>
            Completion Mode: <span className="font-semibold text-foreground">{formatCompletionModeLabel(repoTree?.completion_mode)}</span>
          </div>
          <div>
            Consensus: <span className="font-semibold text-foreground">{repoTree?.consensus_status || "-"}</span>
          </div>
          <div>
            Required Stake: <span className="font-semibold text-foreground">{formatIDR(requiredStake)}</span>
          </div>
          <div>
            Your Stake: <span className="font-semibold text-foreground">{formatIDR(viewerStake)}</span>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-cyan-200/80 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-900/80">Workflow Progress</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                Stage {formatWorkspaceStageLabel(workspaceStageRaw)} • {readinessDone}/{readinessSteps.length} milestone selesai
              </div>
            </div>
            <div className="rounded-full border border-cyan-300 bg-white/80 px-3 py-1 text-xs font-semibold text-cyan-900">
              {readinessPercent}% ready
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 transition-all"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {readinessSteps.map((step) => (
              <div
                key={step.key}
                className={`rounded-[var(--radius)] border px-3 py-2 text-xs ${
                  step.done ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-cyan-200 bg-white/75 text-slate-700"
                }`}
              >
                {step.done ? "✓" : "•"} {step.label}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-[var(--radius)] border border-cyan-200 bg-white/75 px-3 py-2 text-sm text-slate-700">
            Next action: <span className="font-semibold text-slate-900">{nextActionHint}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefreshWorkspace}
              disabled={actionLocked}
              className="rounded-[var(--radius)] border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Refreshing..." : "Refresh Snapshot"}
            </button>
            <a
              href="#workspace-files"
              className="rounded-[var(--radius)] border border-cyan-200 bg-white/85 px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
            >
              Files
            </a>
            <a
              href="#workspace-validators"
              className="rounded-[var(--radius)] border border-cyan-200 bg-white/85 px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
            >
              Validators
            </a>
            <a
              href="#workspace-verdicts"
              className="rounded-[var(--radius)] border border-cyan-200 bg-white/85 px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
            >
              Verdicts
            </a>
          </div>
        </div>

        {!stakeEligible ? (
          <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Stake kamu belum memenuhi syarat untuk apply case ini.
          </div>
        ) : null}
      </section>

      <section id="workspace-files" className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Workspace Files</h2>
        <div className="text-sm text-muted-foreground">
          Publish butuh README (markdown case record atau `case_readme`) dan minimal 1 `task_input`.
        </div>
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">Belum ada file yang terpasang.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Document ID</th>
                  <th className="py-2 pr-3">Visibility</th>
                  <th className="py-2 pr-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{file.kind}</td>
                    <td className="py-2 pr-3 text-foreground">{file.label}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{file.document_id}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{file.visibility}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{formatDateTime(file.uploaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canAttach ? (
          <form onSubmit={onAttachFile} className="grid gap-3 rounded-[var(--radius)] border border-border p-4 md:grid-cols-2">
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
              disabled={actionLocked || sensitiveKindSelected}
            >
              <option value="public">public</option>
              <option value="assigned_validators">assigned_validators</option>
            </select>
            {sensitiveKindSelected ? (
              <div className="text-xs text-muted-foreground md:col-span-2">
                `sensitive_context` selalu dibatasi ke `assigned_validators`.
              </div>
            ) : null}
            {uploadingDocument ? (
              <div className="text-xs text-muted-foreground md:col-span-2">Uploading file... {uploadProgress}%</div>
            ) : null}
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={actionLocked}
            >
              {actionLocked ? "Memproses..." : "Upload & Attach File"}
            </button>
          </form>
        ) : null}
      </section>

      <section id="workspace-validators" className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Validators</h2>
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onPublish}
              className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
              disabled={actionLocked}
            >
              Publish Workspace
            </button>
            <span className="text-sm text-muted-foreground">
              Publish readiness: {repoTree?.has_required_readme ? "README OK" : "README belum ada"} /{" "}
              {repoTree?.has_task_input ? "Task Input OK" : "Task Input belum ada"}
            </span>
          </div>
        ) : (
          <button
            onClick={onApply}
            className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            disabled={applyDisabled}
          >
            {isAssigned ? "Anda sudah terassign" : "Apply as Validator"}
          </button>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Applicants</div>
            {applicants.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Belum ada applicant.</div>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {applicants.map((it) => (
                  <li key={`app-${it.id}`} className="text-foreground">
                    #{it.id} {it.username ? `@${it.username}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Assignments</div>
            {assignments.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Belum ada assignment.</div>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {assignments.map((it) => (
                  <li key={`as-${it.validator?.id}`} className="text-foreground">
                    #{it.validator?.id} {it.validator?.username ? `@${it.validator.username}` : ""} ({it.status}) -{" "}
                    <span className="text-muted-foreground">{formatDateTime(it.assigned_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {isOwner ? (
          <form onSubmit={onAutoAssign} className="grid gap-3 rounded-[var(--radius)] border border-border p-4 md:grid-cols-2">
            <select
              value={assignForm.panel_size}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, panel_size: Number(e.target.value) === 10 ? 10 : 3 }))}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={actionLocked}
            >
              <option value={3}>Panel 3 (default)</option>
              <option value={10}>Panel 10 (escalated)</option>
            </select>
            <div className="text-xs text-muted-foreground">
              Auto-match memilih validator dari applicant pool sesuai stake, anti-pairing, dan limit maksimal 2 task aktif.
            </div>
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={actionLocked}
            >
              {actionLocked ? "Memproses..." : "Auto-Match Validators"}
            </button>
          </form>
        ) : null}
      </section>

      <section id="workspace-verdicts" className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Verdicts & Consensus</h2>
        {isAssigned ? (
          <form onSubmit={onSubmitVerdict} className="grid gap-3 rounded-[var(--radius)] border border-border p-4 md:grid-cols-2">
            <select
              value={verdictForm.verdict}
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, verdict: e.target.value }))}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={actionLocked}
            >
              <option value="valid">valid</option>
              <option value="needs_revision">needs_revision</option>
              <option value="reject">reject</option>
            </select>
            <input
              value={verdictForm.confidence}
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, confidence: e.target.value }))}
              type="number"
              min={0}
              max={100}
              placeholder="confidence 0-100"
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={actionLocked}
            />
            <input
              key={verdictFileInputKey}
              type="file"
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, attachmentFile: e.target.files?.[0] || null }))}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm md:col-span-2"
              disabled={actionLocked}
            />
            <textarea
              value={verdictForm.notes}
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="catatan verdict"
              rows={3}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm md:col-span-2"
              disabled={actionLocked}
            />
            {uploadingDocument ? (
              <div className="text-xs text-muted-foreground md:col-span-2">Uploading verdict attachment... {uploadProgress}%</div>
            ) : null}
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={actionLocked}
            >
              {actionLocked ? "Memproses..." : "Submit Verdict"}
            </button>
          </form>
        ) : (
          <div className="text-sm text-muted-foreground">Hanya validator terassign yang bisa submit verdict.</div>
        )}

        {verdicts.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Validator</th>
                  <th className="py-2 pr-3">Verdict</th>
                  <th className="py-2 pr-3">Confidence</th>
                  <th className="py-2 pr-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {verdicts.map((it) => (
                  <tr key={`vd-${it.validator?.id}-${it.submitted_at}`} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-foreground">
                      #{it.validator?.id} {it.validator?.username ? `@${it.validator.username}` : ""}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{it.verdict}</td>
                    <td className="py-2 pr-3 text-foreground">{it.confidence}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{formatDateTime(it.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {consensus ? (
          <div className="rounded-[var(--radius)] border border-border p-4 text-sm space-y-2">
            <div className="text-foreground">
              Status: <span className="font-semibold">{consensus.consensus_status || "-"}</span>
            </div>
            <div className="text-foreground">
              Result: <span className="font-semibold">{consensus.consensus_result || "-"}</span>
            </div>
            <div className="text-muted-foreground">
              Votes: {consensus.submitted_votes || 0}/{consensus.required_votes || 0}
            </div>
            <div className="text-muted-foreground">
              Breakdown: valid {consensus?.breakdown?.valid || 0} | needs_revision {consensus?.breakdown?.needs_revision || 0} | reject{" "}
              {consensus?.breakdown?.reject || 0}
            </div>

            {consensus?.payout ? (
              <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/30 p-3 space-y-2">
                <div className="text-foreground font-semibold">Payout Ledger</div>
                <div className="text-muted-foreground">
                  Bounty {formatIDR(consensus.payout.bounty_amount)} | Base {formatIDR(consensus.payout.base_pool)} | Quality{" "}
                  {formatIDR(consensus.payout.quality_pool)} | Chain {formatIDR(consensus.payout.chain_pool)}
                </div>
                <ul className="space-y-1 text-sm">
                  {(consensus.payout.entries || []).map((entry) => (
                    <li key={`pay-${entry.validator_user_id}`} className="text-foreground">
                      Validator #{entry.validator_user_id}: base {formatIDR(entry.base_amount)}, quality {formatIDR(entry.quality_amount)},
                      chain {formatIDR(entry.chain_locked)} ({entry.chain_status})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
