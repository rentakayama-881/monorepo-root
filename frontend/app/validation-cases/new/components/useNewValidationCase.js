import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { LOCKED_CATEGORIES } from "@/lib/constants";
import { useUploadDocument } from "@/lib/useDocuments";
import {
  checklistItems,
  sensitivityOptions,
  titleMinLength,
  titleMaxLength,
  hasConnectedTelegramAuth,
  getTagDimensionFromSlug,
  formatCreateCaseError,
  extractDocumentId,
  pickDefaultCategory,
} from "./newCaseUtils";
import { useWorkspaceFiles } from "./useWorkspaceFiles";

export function useNewValidationCase() {
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
  const [workspaceUploadStageMsg, setWorkspaceUploadStageMsg] = useState("");
  const {
    workspaceUploadDraft,
    setWorkspaceUploadDraft,
    workspaceBootstrapFiles,
    workspaceFileInputKey,
    onWorkspaceFilePicked,
    addWorkspaceBootstrapFile: addWorkspaceBootstrapFileRaw,
    removeWorkspaceBootstrapFile,
  } = useWorkspaceFiles();

  function addWorkspaceBootstrapFile() {
    const err = addWorkspaceBootstrapFileRaw();
    if (err) setError(err);
    else setError("");
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [activeReadmeTemplateId, setActiveReadmeTemplateId] = useState("");
  const [insertSnippetSignal, setInsertSnippetSignal] = useState(null);
  const [telegramChecking, setTelegramChecking] = useState(true);
  const [telegramReady, setTelegramReady] = useState(false);
  const {
    uploadDocument,
    loading: uploadingDocument,
    progress: uploadProgress,
  } = useUploadDocument();

  const locked = Boolean(caseType?.slug && LOCKED_CATEGORIES.includes(String(caseType.slug)));
  const telegramGateLocked = telegramChecking || !telegramReady;
  const formDisabled = locked || submitting || telegramGateLocked || uploadingDocument;
  const processStatusText = uploadingDocument
    ? `Uploading file... ${uploadProgress}%`
    : workspaceUploadStageMsg || "";
  const normalizedTagCount = useMemo(
    () =>
      Array.from(
        new Set(
          selectedTags
            .map((tag) =>
              String(tag?.slug || "")
                .toLowerCase()
                .trim()
            )
            .filter(Boolean)
        )
      ).length,
    [selectedTags]
  );
  const checklistCompleted = useMemo(
    () => checklistItems.filter((item) => Boolean(form.checklist?.[item.key])).length,
    [form.checklist]
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
    ]
  );
  const requiredReadinessItems = readinessItems.filter((item) => !item.optional);
  const readinessDoneCount = requiredReadinessItems.filter((item) => item.done).length;
  const readinessPercent = Math.round((readinessDoneCount / requiredReadinessItems.length) * 100);

  useEffect(() => {
    if (!isAuthed) {
      router.push("/login");
    }
    // Mount-only: redirect unauthenticated users
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
        const account = await fetchJsonAuth("/api/account/me", {
          method: "GET",
          clearSessionOn401: false,
        });
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
      setError(
        "Sebelum membuat Validation Case, sambungkan akun Telegram terverifikasi di Account Settings."
      );
      return;
    }

    const title = String(form.title || "").trim();
    const bounty = Number(form.bounty_amount || 0);
    const caseRecord = String(form.case_record_text || "").trim();
    const sensitivity = String(form.sensitivity || "S1")
      .trim()
      .toUpperCase();

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
          .map((t) =>
            String(t?.slug || "")
              .toLowerCase()
              .trim()
          )
          .filter(Boolean)
      )
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
          throw new Error(
            `Upload berhasil tetapi document_id tidak ditemukan untuk "${item.label}".`
          );
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

  return {
    loadingCaseType,
    form,
    setForm,
    workspaceUploadDraft,
    setWorkspaceUploadDraft,
    workspaceBootstrapFiles,
    workspaceFileInputKey,
    availableTags,
    tagsAvailable,
    tagsLoading,
    selectedTags,
    setSelectedTags,
    submitting,
    error,
    ok,
    activeReadmeTemplateId,
    insertSnippetSignal,
    telegramChecking,
    telegramReady,
    locked,
    formDisabled,
    processStatusText,
    readinessDoneCount,
    requiredReadinessItems,
    readinessPercent,
    setChecklist,
    insertReadmeTemplate,
    handleSnippetInserted,
    onWorkspaceFilePicked,
    addWorkspaceBootstrapFile,
    removeWorkspaceBootstrapFile,
    submit,
  };
}
