"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";

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

export default function RepoWorkflowClient() {
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
    document_id: "",
    kind: "task_input",
    label: "",
    visibility: "public",
  });
  const [assignForm, setAssignForm] = useState({
    panel_size: 3,
    validator_user_ids: "",
  });
  const [verdictForm, setVerdictForm] = useState({
    verdict: "valid",
    confidence: 80,
    notes: "",
    document_id: "",
  });

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
  const applyDisabled = busy || isAssigned || !stakeEligible;
  const attachKindOptions = useMemo(
    () => (isOwner ? ["case_readme", "task_input", "sensitive_context"] : ["validator_output"]),
    [isOwner]
  );
  const sensitiveKindSelected = attachForm.kind === "sensitive_context";

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [repoResp, consensusResp] = await Promise.all([
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/repo/tree`, { method: "GET", clearSessionOn401: false }),
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/consensus`, { method: "GET", clearSessionOn401: false }),
      ]);
      setRepoTree(repoResp?.repo_tree || null);
      setConsensus(consensusResp?.consensus || null);
    } catch (e) {
      setError(normalizeErr(e, "Gagal memuat repo workflow"));
      setRepoTree(null);
      setConsensus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) {
      router.push(`/login?redirect=/validation-cases/${encodeURIComponent(id)}/repo`);
      return;
    }
    loadAll();
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
      await loadAll();
      setMsg("Berhasil diperbarui.");
    } catch (e) {
      setError(normalizeErr(e, "Aksi gagal"));
    } finally {
      setBusy(false);
    }
  }

  async function onAttachFile(e) {
    e.preventDefault();
    await runAction(async () => {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/repo/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attachForm),
      });
      setAttachForm((prev) => ({ ...prev, document_id: "", label: "" }));
    });
  }

  async function onPublish() {
    await runAction(async () => {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/publish`, { method: "POST" });
    });
  }

  async function onApply() {
    await runAction(async () => {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/apply`, { method: "POST" });
    });
  }

  async function onAssign(e) {
    e.preventDefault();
    const ids = String(assignForm.validator_user_ids || "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);

    await runAction(async () => {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/validators/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panel_size: Number(assignForm.panel_size) === 10 ? 10 : 3,
          validator_user_ids: ids,
        }),
      });
    });
  }

  async function onSubmitVerdict(e) {
    e.preventDefault();
    await runAction(async () => {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(id)}/verdicts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: verdictForm.verdict,
          confidence: Number(verdictForm.confidence),
          notes: verdictForm.notes,
          document_id: verdictForm.document_id,
        }),
      });
    });
  }

  if (loading) {
    return (
      <main className="container py-10">
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          Memuat repo workflow...
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
        <span className="text-foreground">Repo Workflow</span>
      </nav>

      {error ? (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}
      {msg ? (
        <div className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</div>
      ) : null}

      <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Repo Validation v2</h1>
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <div>Protocol: <span className="font-semibold text-foreground">{repoTree?.protocol_mode || "-"}</span></div>
          <div>Stage: <span className="font-semibold text-foreground">{repoTree?.repo_stage || "-"}</span></div>
          <div>Completion Mode: <span className="font-semibold text-foreground">{repoTree?.completion_mode || "-"}</span></div>
          <div>Consensus: <span className="font-semibold text-foreground">{repoTree?.consensus_status || "-"}</span></div>
          <div>Required Stake: <span className="font-semibold text-foreground">{formatIDR(requiredStake)}</span></div>
          <div>Your Stake: <span className="font-semibold text-foreground">{formatIDR(viewerStake)}</span></div>
        </div>
        {!stakeEligible ? (
          <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Stake kamu belum memenuhi syarat untuk apply case ini.
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Case Files</h2>
        <div className="text-sm text-muted-foreground">
          Required: `case_readme` + minimal 1 `task_input` sebelum publish.
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
              value={attachForm.document_id}
              onChange={(e) => setAttachForm((prev) => ({ ...prev, document_id: e.target.value }))}
              placeholder="document_id"
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              required
              disabled={busy}
            />
            <input
              value={attachForm.label}
              onChange={(e) => setAttachForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Label file"
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              required
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy || sensitiveKindSelected}
            >
              <option value="public">public</option>
              <option value="assigned_validators">assigned_validators</option>
            </select>
            {sensitiveKindSelected ? (
              <div className="text-xs text-muted-foreground md:col-span-2">
                `sensitive_context` selalu dibatasi ke `assigned_validators`.
              </div>
            ) : null}
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={busy}
            >
              {busy ? "Memproses..." : "Attach File"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Validators</h2>
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onPublish}
              className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
              disabled={busy}
            >
              Publish Case
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
          <form onSubmit={onAssign} className="grid gap-3 rounded-[var(--radius)] border border-border p-4 md:grid-cols-2">
            <select
              value={assignForm.panel_size}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, panel_size: Number(e.target.value) === 10 ? 10 : 3 }))}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value={3}>Panel 3</option>
              <option value={10}>Panel 10</option>
            </select>
            <input
              value={assignForm.validator_user_ids}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, validator_user_ids: e.target.value }))}
              placeholder="validator IDs (contoh: 12, 34, 56)"
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={busy}
            />
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={busy}
            >
              {busy ? "Memproses..." : "Assign Validators"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Verdicts & Consensus</h2>
        {isAssigned ? (
          <form onSubmit={onSubmitVerdict} className="grid gap-3 rounded-[var(--radius)] border border-border p-4 md:grid-cols-2">
            <select
              value={verdictForm.verdict}
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, verdict: e.target.value }))}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm"
              disabled={busy}
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
              disabled={busy}
            />
            <input
              value={verdictForm.document_id}
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, document_id: e.target.value }))}
              placeholder="document_id hasil validator (optional)"
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm md:col-span-2"
              disabled={busy}
            />
            <textarea
              value={verdictForm.notes}
              onChange={(e) => setVerdictForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="catatan verdict"
              rows={3}
              className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm md:col-span-2"
              disabled={busy}
            />
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:col-span-2"
              disabled={busy}
            >
              {busy ? "Memproses..." : "Submit Verdict"}
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
