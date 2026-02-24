"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { LOCKED_CATEGORIES } from "@/lib/constants";
import { VALIDATION_CASE_README_TEMPLATES } from "@/lib/validationCaseReadmeTemplates";
import { useUploadDocument } from "@/lib/useDocuments";
import TagSelector from "@/components/ui/TagSelector";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import Button from "@/components/ui/Button";
import NewValidationCaseSkeleton from "./NewValidationCaseSkeleton";
import Skeleton from "@/components/ui/Skeleton";

const quickIntakeFields = [
  {
    key: "validation_goal",
    label: "Masalah yang ingin diselesaikan",
    placeholder: "Contoh: Saya perlu memastikan hasil kerja AI bisa dipakai untuk presentasi klien.",
    minLen: 12,
    maxLen: 800,
  },
  {
    key: "output_type",
    label: "Hasil akhir yang kamu butuhkan",
    placeholder: "Contoh: File Excel final, dokumen revisi, video 30 detik, atau deck presentasi.",
    minLen: 4,
    maxLen: 240,
  },
  {
    key: "evidence_input",
    label: "Materi awal yang sudah tersedia",
    placeholder: "Contoh: draft, raw file, catatan, prompt AI, screenshot, atau data pendukung.",
    minLen: 8,
    maxLen: 2000,
  },
  {
    key: "pass_criteria",
    label: "Standar hasil dianggap selesai",
    placeholder: "Contoh: tidak ada error formula, style sesuai brand, typo <= 2, dan siap submit.",
    minLen: 8,
    maxLen: 2000,
  },
  {
    key: "constraints",
    label: "Batasan penting",
    placeholder: "Contoh: deadline, format wajib, tools yang boleh/tidak boleh, aturan etika/akademik.",
    minLen: 4,
    maxLen: 2000,
  },
];

const checklistItems = [
  {
    key: "intake_complete",
    label: "Quick Intake sudah lengkap dan sesuai konteks.",
  },
  {
    key: "evidence_attached",
    label: "Bukti/input sudah disiapkan agar validator bisa langsung cek.",
  },
  {
    key: "pass_criteria_defined",
    label: "Kriteria lulus ditulis eksplisit dan bisa diverifikasi.",
  },
  {
    key: "constraints_defined",
    label: "Batasan dan ruang lingkup sudah jelas.",
  },
  {
    key: "no_contact_in_case_record",
    label: "Case Record tidak berisi detail kontak langsung.",
  },
];

const sensitivityOptions = ["S0", "S1", "S2", "S3"];
const titleMinLength = 3;
const titleMaxLength = 200;
const autoBriefLabelMap = {
  objective: "Tujuan",
  expected_output_type: "Output",
  evidence_scope: "Materi awal",
  pass_gate: "Kriteria lulus",
  constraints: "Batasan",
  sensitivity: "Sensitivitas",
  owner_response_sla: "SLA owner",
};

function formatIDR(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "";
  return Math.max(0, Math.trunc(n)).toLocaleString("id-ID");
}

function sanitizeNumericInput(raw) {
  return String(raw || "")
    .replace(/[^\d]/g, "")
    .replace(/^0+(?=\d)/, "");
}

function hasConnectedTelegramAuth(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(value.connected);
}

function getTagDimensionFromSlug(rawSlug) {
  const slug = String(rawSlug || "").toLowerCase();
  if (slug.startsWith("artifact-")) return "artifact";
  if (slug.startsWith("stage-")) return "stage";
  if (slug.startsWith("domain-")) return "domain";
  if (slug.startsWith("evidence-")) return "evidence";
  return "";
}

function formatCreateCaseError(err, fallback = "Gagal membuat Validation Case") {
  const message = String(err?.message || fallback).trim();
  const details = String(err?.details || "").trim();
  if (!details) return message || fallback;
  const generic = new Set(["input tidak valid", "field wajib tidak ada", "request body tidak valid"]);
  if (generic.has(message.toLowerCase())) {
    return details;
  }
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

function pickDefaultCategory(list) {
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  return (
    items.find((c) => String(c?.slug || "").toLowerCase() === "general") ||
    items.find((c) => String(c?.slug || "").toLowerCase() === "others") ||
    items[0]
  );
}

function buildAutoSummary(quickIntake) {
  const goal = String(quickIntake?.validation_goal || "").trim();
  const outputType = String(quickIntake?.output_type || "").trim();
  const passCriteria = String(quickIntake?.pass_criteria || "").trim();
  if (!goal && !outputType && !passCriteria) return "";
  return `Tujuan: ${goal || "-"}. Output: ${outputType || "-"}. Lulus jika: ${passCriteria || "-"}.`;
}

function buildAutoBrief(quickIntake) {
  return {
    objective: String(quickIntake?.validation_goal || "").trim(),
    expected_output_type: String(quickIntake?.output_type || "").trim(),
    evidence_scope: String(quickIntake?.evidence_input || "").trim(),
    pass_gate: String(quickIntake?.pass_criteria || "").trim(),
    constraints: String(quickIntake?.constraints || "").trim(),
    sensitivity: String(quickIntake?.sensitivity || "S1").trim().toUpperCase(),
    owner_response_sla: "Max 12 jam (reminder +2h, +8h, auto-hold +12h)",
  };
}

export default function NewValidationCaseClient() {
  const router = useRouter();

  const isAuthed = useMemo(() => {
    try {
      return !!getToken();
    } catch {
      return false;
    }
  }, []);

  const [caseType, setCaseType] = useState(null);
  const [loadingCaseType, setLoadingCaseType] = useState(true);

  const [availableTags, setAvailableTags] = useState([]);
  const [tagsAvailable, setTagsAvailable] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);

  const [form, setForm] = useState({
    title: "",
    bounty_amount: "10000",
    quick_intake: {
      validation_goal: "",
      output_type: "",
      evidence_input: "",
      pass_criteria: "",
      constraints: "",
      sensitivity: "S1",
    },
    case_record_text: "",
    checklist: {
      intake_complete: false,
      evidence_attached: false,
      pass_criteria_defined: false,
      constraints_defined: false,
      no_contact_in_case_record: false,
    },
  });
  const [workspaceUploadDraft, setWorkspaceUploadDraft] = useState({
    file: null,
    kind: "task_input",
    label: "",
    visibility: "public",
  });
  const [workspaceBootstrapFiles, setWorkspaceBootstrapFiles] = useState([]);
  const [workspaceFileInputKey, setWorkspaceFileInputKey] = useState(0);
  const [workspaceUploadStageMsg, setWorkspaceUploadStageMsg] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [activeReadmeTemplateId, setActiveReadmeTemplateId] = useState("");
  const [insertSnippetSignal, setInsertSnippetSignal] = useState(null);
  const [telegramChecking, setTelegramChecking] = useState(true);
  const [telegramReady, setTelegramReady] = useState(false);
  const { uploadDocument, loading: uploadingDocument, progress: uploadProgress } = useUploadDocument();

  const locked = Boolean(caseType?.slug && LOCKED_CATEGORIES.includes(String(caseType.slug)));
  const telegramGateLocked = telegramChecking || !telegramReady;
  const formDisabled = locked || submitting || telegramGateLocked || uploadingDocument;
  const autoSummary = useMemo(() => buildAutoSummary(form.quick_intake), [form.quick_intake]);
  const autoBrief = useMemo(() => buildAutoBrief(form.quick_intake), [form.quick_intake]);

  useEffect(() => {
    if (!isAuthed) {
      router.push("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCaseType() {
      setLoadingCaseType(true);
      try {
        const data = await fetchJson("/api/validation-cases/categories", { method: "GET" });
        const list = Array.isArray(data?.categories) ? data.categories : [];
        const chosen = pickDefaultCategory(list);
        if (!cancelled) setCaseType(chosen ? { slug: chosen.slug, name: chosen.name } : null);
      } catch {
        if (!cancelled) setCaseType(null);
      } finally {
        if (!cancelled) setLoadingCaseType(false);
      }
    }

    async function loadTags() {
      setTagsLoading(true);
      try {
        const data = await fetchJson("/api/tags", { method: "GET" });
        const resolved = Array.isArray(data) ? data : Array.isArray(data?.tags) ? data.tags : [];
        if (!cancelled) {
          setAvailableTags(resolved);
          setTagsAvailable(resolved.length > 0);
        }
      } catch {
        if (!cancelled) {
          setAvailableTags([]);
          setTagsAvailable(false);
        }
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    }

    async function loadTelegramGate() {
      if (!isAuthed) {
        if (!cancelled) {
          setTelegramReady(false);
          setTelegramChecking(false);
        }
        return;
      }

      setTelegramChecking(true);
      try {
        const account = await fetchJsonAuth("/api/account/me", { method: "GET", clearSessionOn401: false });
        if (!cancelled) {
          setTelegramReady(hasConnectedTelegramAuth(account?.telegram_auth));
        }
      } catch {
        if (!cancelled) {
          setTelegramReady(false);
        }
      } finally {
        if (!cancelled) setTelegramChecking(false);
      }
    }

    loadCaseType();
    loadTags();
    loadTelegramGate();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  function setQuickIntake(key, value) {
    setForm((prev) => ({
      ...prev,
      quick_intake: {
        ...prev.quick_intake,
        [key]: value,
      },
    }));
  }

  function setChecklist(key, checked) {
    setForm((prev) => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [key]: checked,
      },
    }));
  }

  function insertReadmeTemplate(template) {
    if (formDisabled || !template?.id || !template?.snippet) return;
    const snippetId = `${template.id}-${Date.now()}`;
    setActiveReadmeTemplateId(template.id);
    setInsertSnippetSignal({ id: snippetId, text: template.snippet });
  }

  function handleSnippetInserted(snippetId) {
    setInsertSnippetSignal((prev) => (prev?.id === snippetId ? null : prev));
  }

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
      setError("Pilih file dulu sebelum menambahkan ke daftar upload.");
      return;
    }

    const kind = String(workspaceUploadDraft.kind || "task_input").trim();
    const label = String(workspaceUploadDraft.label || "").trim();
    const visibility = kind === "sensitive_context"
      ? "assigned_validators"
      : String(workspaceUploadDraft.visibility || "public").trim();

    if (!label) {
      setError("Label file wajib diisi.");
      return;
    }

    setWorkspaceBootstrapFiles((prev) => [
      ...prev,
      {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        kind,
        label,
        visibility,
      },
    ]);
    setWorkspaceUploadDraft({
      file: null,
      kind: "task_input",
      label: "",
      visibility: "public",
    });
    setWorkspaceFileInputKey((prev) => prev + 1);
    setError("");
  }

  function removeWorkspaceBootstrapFile(localId) {
    setWorkspaceBootstrapFiles((prev) => prev.filter((item) => item.localId !== localId));
  }

  async function submit() {
    setError("");
    setOk("");
    setWorkspaceUploadStageMsg("");

    if (!caseType?.slug) {
      setError("Konfigurasi intake belum siap. Hubungi admin.");
      return;
    }

    if (locked) {
      setError("Intake sedang ditutup.");
      return;
    }
    if (telegramGateLocked) {
      setError("Sebelum membuat Validation Case, sambungkan akun Telegram terverifikasi di Account Settings.");
      return;
    }

    const title = String(form.title || "").trim();
    const bounty = Number(form.bounty_amount || 0);
    const caseRecord = String(form.case_record_text || "").trim();
    const sensitivity = String(form.quick_intake?.sensitivity || "S1").trim().toUpperCase();

    if (title.length < titleMinLength) {
      setError(`Title minimal ${titleMinLength} karakter.`);
      return;
    }
    if (title.length > titleMaxLength) {
      setError(`Title maksimal ${titleMaxLength} karakter.`);
      return;
    }
    if (!bounty || bounty < 10000) {
      setError("Bounty minimal Rp 10.000.");
      return;
    }
    if (!Number.isSafeInteger(bounty)) {
      setError("Nominal bounty terlalu besar.");
      return;
    }
    for (const item of quickIntakeFields) {
      const value = String(form.quick_intake?.[item.key] || "").trim();
      if (!value) {
        setError(`${item.label} wajib diisi.`);
        return;
      }
      if (value.length < item.minLen) {
        setError(`${item.label} minimal ${item.minLen} karakter.`);
        return;
      }
      if (value.length > item.maxLen) {
        setError(`${item.label} maksimal ${item.maxLen} karakter.`);
        return;
      }
    }
    if (!sensitivityOptions.includes(sensitivity)) {
      setError("Sensitivitas harus S0, S1, S2, atau S3.");
      return;
    }
    if (!caseRecord) {
      setError("Case Record wajib diisi.");
      return;
    }
    if (/t\.me\/|telegram|wa\.me\/|whatsapp/i.test(caseRecord)) {
      setError("Case Record tidak boleh memuat kontak langsung.");
      return;
    }
    const normalizedTagSlugs = Array.from(
      new Set(
        selectedTags
          .map((t) => String(t?.slug || "").toLowerCase().trim())
          .filter(Boolean),
      ),
    );
    if (normalizedTagSlugs.length < 2 || normalizedTagSlugs.length > 4) {
      setError("Tags wajib minimal 2 dan maksimal 4 sesuai taxonomy.");
      return;
    }
    const seenDimensions = new Map();
    for (const slug of normalizedTagSlugs) {
      const dim = getTagDimensionFromSlug(slug);
      if (!dim) continue;
      const existing = seenDimensions.get(dim);
      if (existing) {
        setError(`Tag dimensi '${dim}' hanya boleh satu (${existing} dan ${slug}).`);
        return;
      }
      seenDimensions.set(dim, slug);
    }
    const unchecked = checklistItems.find((it) => !Boolean(form.checklist?.[it.key]));
    if (unchecked) {
      setError("Checklist protokol wajib dilengkapi sebelum submit.");
      return;
    }

    setSubmitting(true);
    try {
      const workspaceBootstrapPayload = [];
      for (let idx = 0; idx < workspaceBootstrapFiles.length; idx += 1) {
        const item = workspaceBootstrapFiles[idx];
        const progressLabel = `Uploading file ${idx + 1}/${workspaceBootstrapFiles.length}: ${item.label}`;
        setWorkspaceUploadStageMsg(progressLabel);
        const uploaded = await uploadDocument(item.file, {
          title: item.label,
          description: `Validation workspace bootstrap (${item.kind})`,
          category: "other",
          visibility: "private",
        });
        const documentId = extractDocumentId(uploaded);
        if (!documentId) {
          throw new Error(`Upload berhasil tetapi document_id tidak ditemukan untuk "${item.label}".`);
        }
        workspaceBootstrapPayload.push({
          document_id: documentId,
          kind: item.kind,
          label: item.label,
          visibility: item.kind === "sensitive_context" ? "assigned_validators" : item.visibility,
        });
      }

      const content = {
        quick_intake: {
          ...form.quick_intake,
          sensitivity,
        },
        checklist: { ...form.checklist },
        case_record_text: caseRecord,
      };

      const body = {
        category_slug: String(caseType.slug),
        title,
        summary: autoSummary,
        content_type: "json",
        content,
        bounty_amount: bounty,
        tag_slugs: normalizedTagSlugs,
        workspace_bootstrap_files: workspaceBootstrapPayload,
        meta: {
          workflow_family: "evidence_validation_workspace",
          workflow_name: "Evidence Validation Workspace",
          completion_mode: "panel_3",
          consensus_status: "pending",
          workspace_stage: "draft",
        },
      };

      setWorkspaceUploadStageMsg("Creating validation case...");
      const created = await fetchJsonAuth("/api/validation-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const id = created?.id;
      setOk("Validation Case berhasil dibuat.");
      if (id != null) {
        router.push(`/validation-cases/${encodeURIComponent(String(id))}`);
      }
    } catch (e) {
      setError(formatCreateCaseError(e));
    } finally {
      setWorkspaceUploadStageMsg("");
      setSubmitting(false);
    }
  }

  if (loadingCaseType) {
    return <NewValidationCaseSkeleton />;
  }

  return (
    <main className="container py-8 md:py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
          Validation Case Index
        </Link>
        <span>/</span>
        <span className="text-foreground">Create</span>
      </nav>

      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Brief Tugas Cepat
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Create Validation Case</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Isi ringkas dulu agar validator langsung paham konteks kerja. Sistem akan menyusun ringkasan otomatis
          agar proses cepat, jelas, dan bisa diaudit.
        </p>
      </header>

      {locked ? (
        <div className="mb-5 rounded-[var(--radius)] border border-border bg-secondary/60 px-5 py-4 text-sm text-muted-foreground">
          Intake sedang ditutup.
        </div>
      ) : null}
      {!telegramReady ? (
        <div className="mb-5 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {telegramChecking ? (
            "Memverifikasi Telegram Auth akun Anda..."
          ) : (
            <>
              Anda wajib menyambungkan akun Telegram terverifikasi di
              {" "}
              <Link href="/account" className="font-semibold underline">
                Account Settings
              </Link>
              {" "}
              sebelum mengisi Create Validation Case.
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-[var(--radius)] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {ok ? (
        <div className="mb-5 rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          {ok}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="text-sm font-semibold text-foreground">Protocol Intake</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Isi brief inti, pilih minimal 2 tags, lalu tambahkan catatan tambahan jika perlu.
          </div>
        </div>

        <div className="space-y-6 px-5 py-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
              placeholder="Ringkas dan spesifik."
              disabled={formDisabled}
            />
          </div>

          <div className="rounded-[var(--radius)] border border-border bg-secondary/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Layer 1 - Quick Intake (Wajib)
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {quickIntakeFields.map((field) => (
                <div key={field.key} className={field.key === "evidence_input" || field.key === "constraints" ? "md:col-span-2" : ""}>
                  <label className="text-xs font-semibold text-muted-foreground">{field.label}</label>
                  <textarea
                    value={form.quick_intake?.[field.key] || ""}
                    onChange={(e) => setQuickIntake(field.key, e.target.value)}
                    rows={field.key === "evidence_input" || field.key === "constraints" ? 3 : 2}
                    className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                    placeholder={field.placeholder}
                    disabled={formDisabled}
                  />
                </div>
              ))}

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tingkat kerahasiaan</label>
                <select
                  value={form.quick_intake?.sensitivity || "S1"}
                  onChange={(e) => setQuickIntake("sensitivity", e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                  disabled={formDisabled}
                >
                  <option value="S0">S0 - Public</option>
                  <option value="S1">S1 - Restricted</option>
                  <option value="S2">S2 - Confidential</option>
                  <option value="S3">S3 - Critical</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Bounty (IDR)</label>
                <input
                  value={form.bounty_amount}
                  onChange={(e) => {
                    const next = sanitizeNumericInput(e.target.value);
                    setForm((prev) => ({ ...prev, bounty_amount: next }));
                  }}
                  className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                  inputMode="numeric"
                  placeholder="10000"
                  maxLength={15}
                  disabled={formDisabled}
                />
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Minimal Rp 10.000. Estimasi saat ini: {form.bounty_amount ? `Rp ${formatIDR(form.bounty_amount)}` : "-"}.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Layer 2 - Auto Validation Brief
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {Object.entries(autoBrief)
                      .slice(0, 4)
                      .map(([label, value]) => (
                        <tr key={label}>
                          <td className="w-40 bg-secondary/40 px-3 py-2 font-semibold text-foreground">
                            {autoBriefLabelMap[label] || label}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{String(value || "-")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {Object.entries(autoBrief)
                      .slice(4)
                      .map(([label, value]) => (
                        <tr key={label}>
                          <td className="w-40 bg-secondary/40 px-3 py-2 font-semibold text-foreground">
                            {autoBriefLabelMap[label] || label}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{String(value || "-")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Summary otomatis: {autoSummary || "-"}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">README Design Templates</label>
            <div className="mt-2 rounded-[var(--radius)] border border-border bg-gradient-to-br from-slate-50 via-cyan-50 to-indigo-100 p-4">
              <div className="text-sm font-semibold text-foreground">GitHub-style template siap edit</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Pilih template visual, lalu klik insert. Isi tetap custom dari kamu sendiri. Tag protocol tetap wajib.
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {VALIDATION_CASE_README_TEMPLATES.map((template) => {
                  const selected = activeReadmeTemplateId === template.id;
                  return (
                    <article
                      key={template.id}
                      className={`rounded-[var(--radius)] border p-3 shadow-sm transition ${
                        template.palette?.cardClass || "border-border bg-card"
                      } ${selected ? "ring-2 ring-primary/60" : ""}`}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(template.previewBadges)
                          ? template.previewBadges.map((badgeLabel) => (
                              <span
                                key={`${template.id}-${badgeLabel}`}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                  template.palette?.badgeClass || "border-border bg-secondary/40 text-foreground"
                                }`}
                              >
                                {badgeLabel}
                              </span>
                            ))
                          : null}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">{template.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{template.description}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {template.category}
                      </div>
                      <button
                        type="button"
                        onClick={() => insertReadmeTemplate(template)}
                        disabled={formDisabled}
                        className={`mt-3 inline-flex w-full items-center justify-center rounded-[var(--radius)] border px-3 py-1.5 text-xs font-semibold transition ${
                          template.palette?.buttonClass || "border-border text-foreground hover:bg-secondary"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        Insert Template
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Case Record (Free Text)</label>
            <div className="mt-1">
              <MarkdownEditor
                value={form.case_record_text}
                onChange={(next) => setForm((prev) => ({ ...prev, case_record_text: next }))}
                placeholder="Gunakan Markdown: poin, checklist, tabel kecil, dan acceptance criteria."
                minHeight="280px"
                preview={MarkdownPreview}
                disabled={formDisabled}
                insertSnippetSignal={insertSnippetSignal}
                onSnippetInserted={handleSnippetInserted}
              />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Gunakan markdown secukupnya. Jangan masukkan kontak langsung (Telegram/WhatsApp) di Case Record.
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-border bg-secondary/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Workspace Files (Optional di Create)
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Upload file sekarang agar validator bisa langsung kerja. File sensitif otomatis hanya untuk validator terpilih.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                key={workspaceFileInputKey}
                type="file"
                onChange={(e) => onWorkspaceFilePicked(e.target.files?.[0] || null)}
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
              <select
                value={workspaceUploadDraft.kind}
                onChange={(e) =>
                  setWorkspaceUploadDraft((prev) => {
                    const nextKind = e.target.value;
                    return {
                      ...prev,
                      kind: nextKind,
                      visibility: nextKind === "sensitive_context" ? "assigned_validators" : prev.visibility,
                    };
                  })
                }
                className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                disabled={formDisabled}
              >
                <option value="task_input">task_input</option>
                <option value="case_readme">case_readme</option>
                <option value="sensitive_context">sensitive_context</option>
              </select>
              <select
                value={workspaceUploadDraft.visibility}
                onChange={(e) => setWorkspaceUploadDraft((prev) => ({ ...prev, visibility: e.target.value }))}
                className="rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                disabled={formDisabled || workspaceUploadDraft.kind === "sensitive_context"}
              >
                <option value="public">public</option>
                <option value="assigned_validators">assigned_validators</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addWorkspaceBootstrapFile}
                disabled={formDisabled}
                className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add File to Queue
              </button>
              {uploadingDocument ? (
                <span className="text-xs text-muted-foreground">Upload progress: {uploadProgress}%</span>
              ) : null}
              {workspaceUploadStageMsg ? (
                <span className="text-xs text-muted-foreground">{workspaceUploadStageMsg}</span>
              ) : null}
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
                        <td className="px-3 py-2 font-mono text-xs text-foreground">{item.kind}</td>
                        <td className="px-3 py-2 text-foreground">{item.label}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.visibility}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.file?.name || "-"}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeWorkspaceBootstrapFile(item.localId)}
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
                Belum ada file di queue. Kamu tetap bisa create case sekarang dan upload nanti di Workspace.
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Checklist Protokol (Wajib)</label>
            <div className="mt-2 space-y-2 rounded-[var(--radius)] border border-border bg-secondary/20 p-3">
              {checklistItems.map((item) => (
                <label key={item.key} className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(form.checklist?.[item.key])}
                    onChange={(e) => setChecklist(item.key, e.target.checked)}
                    disabled={formDisabled}
                    className="mt-0.5"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tags (Wajib)</label>
            {tagsAvailable ? (
              <TagSelector
                availableTags={availableTags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                maxTags={4}
                placeholder="Pilih minimal 2 tags..."
                enableSearch={true}
                singlePerGroup={true}
                disabled={formDisabled}
              />
            ) : tagsLoading ? (
              <div className="mt-1">
                <Skeleton className="h-[120px] w-full" />
              </div>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">Tags tidak tersedia.</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              href="/validation-cases"
              prefetch={false}
              variant="secondary"
              size="sm"
            >
              Back to Case Index
            </Button>
            <Button
              onClick={submit}
              disabled={formDisabled}
              loading={submitting}
              size="sm"
              type="button"
            >
              {submitting ? "Submitting..." : "Create Validation Case"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
