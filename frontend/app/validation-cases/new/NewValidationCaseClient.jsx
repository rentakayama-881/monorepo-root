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
import NativeSelect from "@/components/ui/NativeSelect";
import NewValidationCaseSkeleton from "./NewValidationCaseSkeleton";
import Skeleton from "@/components/ui/Skeleton";
import { formatRepoFileKindLabel, formatRepoFileVisibilityLabel } from "@/lib/repoFileLabels";

const checklistItems = [
  {
    key: "scope_clearly_written",
    label: "README menjelaskan scope, tujuan validasi, dan output yang diharapkan.",
  },
  {
    key: "acceptance_criteria_defined",
    label: "Acceptance criteria ditulis jelas dan bisa diverifikasi.",
  },
  {
    key: "sensitive_data_filtered",
    label: "Data sensitif sudah difilter dari file publik dan dipisahkan bila perlu.",
  },
  {
    key: "no_contact_in_case_record",
    label: "Case Record tidak berisi detail kontak langsung.",
  },
];

const createNavigationSections = [
  { id: "case-setup", label: "1. Case Setup" },
  { id: "readme-design", label: "2. README Design" },
  { id: "workspace-files", label: "3. Workspace Files" },
  { id: "quality-gate", label: "4. Checklist & Tags" },
];

const sensitivityOptions = ["S0", "S1", "S2", "S3"];
const titleMinLength = 3;
const titleMaxLength = 200;

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

function buildRecordPreview(markdownRaw) {
  const text = String(markdownRaw || "")
    .replace(/[#*_`>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}...`;
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
    sensitivity: "S1",
    case_record_text: "",
    checklist: {
      scope_clearly_written: false,
      acceptance_criteria_defined: false,
      sensitive_data_filtered: false,
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
  const processStatusText = uploadingDocument
    ? `Uploading file... ${uploadProgress}%`
    : workspaceUploadStageMsg || "";
  const recordPreview = useMemo(() => buildRecordPreview(form.case_record_text), [form.case_record_text]);
  const normalizedTagCount = useMemo(
    () =>
      Array.from(
        new Set(
          selectedTags
            .map((tag) => String(tag?.slug || "").toLowerCase().trim())
            .filter(Boolean),
        ),
      ).length,
    [selectedTags],
  );
  const checklistCompleted = useMemo(
    () => checklistItems.filter((item) => Boolean(form.checklist?.[item.key])).length,
    [form.checklist],
  );
  const caseSetupReady = useMemo(() => {
    const title = String(form.title || "").trim();
    const bounty = Number(form.bounty_amount || 0);
    return (
      title.length >= titleMinLength &&
      title.length <= titleMaxLength &&
      Number.isSafeInteger(bounty) &&
      bounty >= 10_000 &&
      sensitivityOptions.includes(String(form.sensitivity || "").toUpperCase())
    );
  }, [form.title, form.bounty_amount, form.sensitivity]);
  const readinessItems = useMemo(
    () => [
      {
        id: "case-setup",
        label: "Title, bounty, sensitivity valid",
        done: caseSetupReady,
      },
      {
        id: "readme-design",
        label: "README/case record terisi",
        done: String(form.case_record_text || "").trim().length > 0,
      },
      {
        id: "workspace-files",
        label: "File awal disiapkan (opsional)",
        done: workspaceBootstrapFiles.length > 0,
        optional: true,
      },
      {
        id: "quality-gate",
        label: "Checklist protokol lengkap",
        done: checklistCompleted === checklistItems.length,
      },
      {
        id: "quality-gate",
        label: "Tags 2-4 terpilih",
        done: normalizedTagCount >= 2 && normalizedTagCount <= 4,
      },
    ],
    [
      caseSetupReady,
      form.case_record_text,
      workspaceBootstrapFiles.length,
      checklistCompleted,
      normalizedTagCount,
    ],
  );
  const requiredReadinessItems = readinessItems.filter((item) => !item.optional);
  const readinessDoneCount = requiredReadinessItems.filter((item) => item.done).length;
  const readinessPercent = Math.round((readinessDoneCount / requiredReadinessItems.length) * 100);

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
    const sensitivity = String(form.sensitivity || "S1").trim().toUpperCase();

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
        const documentVisibility =
          item.kind === "sensitive_context" || item.visibility !== "public" ? "private" : "public";
        const uploaded = await uploadDocument(item.file, {
          title: item.label,
          description: `Validation workspace bootstrap (${item.kind})`,
          category: "other",
          visibility: documentVisibility,
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
        case_record_text: caseRecord,
        sensitivity_level: sensitivity,
        checklist: { ...form.checklist },
      };

      const body = {
        category_slug: String(caseType.slug),
        title,
        summary: "",
        content_type: "json",
        content,
        bounty_amount: bounty,
        tag_slugs: normalizedTagSlugs,
        workspace_bootstrap_files: workspaceBootstrapPayload,
        meta: {
          workflow_family: "evidence_validation_workspace",
          workflow_name: "Evidence Validation Workspace",
          completion_mode: "open",
          consensus_status: "pending",
          workspace_stage: "ready",
        },
      };

      setWorkspaceUploadStageMsg("Creating validation case...");
      const created = await fetchJsonAuth("/api/validation-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const id = created?.id;
      if (id != null) {
        router.push(`/validation-cases/${encodeURIComponent(String(id))}`);
        return;
      }
      setOk("Validation Case berhasil dibuat.");
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
    <main className="container py-8 md:py-10 [scrollbar-gutter:stable]">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
          Validation Case Index
        </Link>
        <span>/</span>
        <span className="text-foreground">Create</span>
      </nav>

      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          README-First Case Builder
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Create Validation Case</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Jelaskan kebutuhan validasi langsung di README case, lalu lampirkan file pendukung.
          Tidak perlu alur chat panjang sebelum case diproses validator.
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

      <div className="mb-5 min-h-[64px]">
        {error ? (
          <div role="alert" aria-live="polite" className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {!error && ok ? (
          <div role="status" aria-live="polite" className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
            {ok}
          </div>
        ) : null}
      </div>

      <section className="mb-5 rounded-[var(--radius)] border border-cyan-200/80 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-100 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-900/80">Workspace Readiness</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {readinessDoneCount}/{requiredReadinessItems.length} syarat wajib selesai
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
        <div className="mt-3 flex flex-wrap gap-2">
          {createNavigationSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-cyan-300 bg-white/85 px-3 py-1 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
            >
              {section.label}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="text-sm font-semibold text-foreground">Case Setup</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Tulis README case, set sensitivity + bounty, upload file yang relevan, lalu create. Case langsung ready.
          </div>
        </div>

        <div className="space-y-6 px-5 py-5">
          <div id="case-setup" className="rounded-[var(--radius)] border border-border bg-secondary/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Case Setup (Wajib)
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                  placeholder="Contoh: Validasi draft skripsi Bab 3 hasil AI"
                  disabled={formDisabled}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tingkat kerahasiaan</label>
                <NativeSelect
                  value={form.sensitivity || "S1"}
                  onChange={(e) => setForm((prev) => ({ ...prev, sensitivity: e.target.value }))}
                  options={[
                    { value: "S0", label: "S0 - Public" },
                    { value: "S1", label: "S1 - Restricted" },
                    { value: "S2", label: "S2 - Confidential" },
                    { value: "S3", label: "S3 - Critical" },
                  ]}
                  className="mt-1"
                  disabled={formDisabled}
                />
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

          <div id="readme-design">
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
            <div className="mt-2 rounded-[var(--radius)] border border-border/80 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
              Preview ringkas: {recordPreview || "-"}
            </div>
          </div>

          <div id="workspace-files" className="rounded-[var(--radius)] border border-border bg-secondary/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace Files</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Upload file sekarang agar validator bisa langsung kerja. File sensitif otomatis hanya untuk validator terpilih.
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Queue saat ini: {workspaceBootstrapFiles.length} file.
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
              <NativeSelect
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
                options={[
                  { value: "task_input", label: formatRepoFileKindLabel("task_input") },
                  { value: "case_readme", label: formatRepoFileKindLabel("case_readme") },
                  { value: "sensitive_context", label: formatRepoFileKindLabel("sensitive_context") },
                ]}
                disabled={formDisabled}
              />
              <NativeSelect
                value={workspaceUploadDraft.visibility}
                onChange={(e) => setWorkspaceUploadDraft((prev) => ({ ...prev, visibility: e.target.value }))}
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
                onClick={addWorkspaceBootstrapFile}
                disabled={formDisabled}
                className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add File to Queue
              </button>
            </div>
            <div className="mt-1 min-h-[18px] truncate text-xs text-muted-foreground" title={processStatusText || ""}>
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
                        <td className="px-3 py-2 text-xs font-semibold text-foreground">{formatRepoFileKindLabel(item.kind)}</td>
                        <td className="px-3 py-2 text-foreground">{item.label}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatRepoFileVisibilityLabel(item.visibility)}</td>
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
              <div className="mt-3 text-xs text-muted-foreground">Belum ada file di queue. Kamu tetap bisa create case sekarang dan upload nanti di repo case.</div>
            )}
          </div>

          <div id="quality-gate">
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

          <div className="mt-6 relative z-[120]">
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
              className="min-w-[12.5rem]"
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
