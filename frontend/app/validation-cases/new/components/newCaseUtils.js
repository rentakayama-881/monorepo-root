export const checklistItems = [
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

export const createNavigationSections = [
  { id: "case-setup", label: "1. Case Setup" },
  { id: "readme-design", label: "2. README Design" },
  { id: "workspace-files", label: "3. Workspace Files" },
  { id: "quality-gate", label: "4. Checklist & Tags" },
];

export const sensitivityOptions = ["S0", "S1", "S2", "S3"];
export const titleMinLength = 3;
export const titleMaxLength = 200;

export function sanitizeNumericInput(raw) {
  return String(raw || "")
    .replace(/[^\d]/g, "")
    .replace(/^0+(?=\d)/, "");
}

export function hasConnectedTelegramAuth(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(value.connected);
}

export function getTagDimensionFromSlug(rawSlug) {
  const slug = String(rawSlug || "").toLowerCase();
  if (slug.startsWith("artifact-")) return "artifact";
  if (slug.startsWith("stage-")) return "stage";
  if (slug.startsWith("domain-")) return "domain";
  if (slug.startsWith("evidence-")) return "evidence";
  return "";
}

export function formatCreateCaseError(err, fallback = "Gagal membuat Validation Case") {
  const message = String(err?.message || fallback).trim();
  const details = String(err?.details || "").trim();
  if (!details) return message || fallback;
  const generic = new Set([
    "input tidak valid",
    "field wajib tidak ada",
    "request body tidak valid",
  ]);
  if (generic.has(message.toLowerCase())) {
    return details;
  }
  return `${message}: ${details}`;
}

export function extractDocumentId(uploadResult) {
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

export function pickDefaultCategory(list) {
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  return (
    items.find((c) => String(c?.slug || "").toLowerCase() === "general") ||
    items.find((c) => String(c?.slug || "").toLowerCase() === "others") ||
    items[0]
  );
}
