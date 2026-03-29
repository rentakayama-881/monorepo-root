/**
 * ContentTable — renders validation case record content in a structured table.
 * Extracted from ValidationCaseDetailClient.jsx.
 */

import dynamic from "next/dynamic";
import { isValidElement } from "react";
import { contentAsText, stripLeadingRecordLabel } from "./validationCaseDetailUtils";

const MarkdownPreview = dynamic(() => import("@/components/ui/MarkdownPreview"), {
  loading: () => <div className="h-6 w-full animate-pulse rounded bg-secondary" />,
});

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const CONTENT_LABEL_MAP = {
  objective: "Fokus Validasi",
  expected_output_type: "Hasil Akhir yang Diharapkan",
  evidence_scope: "Materi yang Diperiksa",
  pass_gate: "Standar Dinyatakan Selesai",
  constraints: "Batasan",
  sensitivity: "Tingkat Kerahasiaan",
  owner_response_sla: "SLA Respons Owner",
  validation_goal: "Masalah yang Ingin Diselesaikan",
  output_type: "Hasil Akhir yang Dibutuhkan",
  evidence_input: "Materi Awal yang Tersedia",
  pass_criteria: "Kriteria Diterima",
  case_record_text: "Catatan Tambahan",
  case_record: "Catatan Tambahan",
  record: "Catatan Tambahan",
  sensitivity_policy: "Kebijakan Sensitivitas",
  schema_version: "Versi Intake",
  max_hours: "Batas Waktu (Jam)",
  reminder_hours: "Pengingat (Jam)",
  timeout_outcome: "Status Saat Timeout",
  reassignment: "Reassignment Validator",
  validator_penalty: "Penalti Validator",
  visibility: "Akses Visibilitas",
  telegram_allowed: "Telegram Diizinkan",
  requires_admin_gate: "Perlu Admin Gate",
  requires_pre_moderation: "Perlu Pre-Moderasi",
};

const RESERVED_CONTENT_KEYS = new Set([
  "quick_intake",
  "checklist",
  "case_record_text",
  "case_record",
  "record",
]);

function canonicalContentKey(keyRaw) {
  const key = String(keyRaw || "").trim();
  if (!key) return "";
  const snake = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return snake.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function extractCaseRecordText(content) {
  if (!isPlainObject(content)) return "";
  for (const [key, value] of Object.entries(content)) {
    const canonical = canonicalContentKey(key);
    if (canonical === "case_record_text" || canonical === "case_record" || canonical === "record") {
      if (typeof value === "string") return value.trim();
      if (isPlainObject(value) && typeof value.text === "string") return value.text.trim();
    }
  }
  return "";
}

function isRecordRowLabel(labelRaw) {
  const canonical = canonicalContentKey(labelRaw);
  return canonical === "record" || canonical === "case_record" || canonical === "case_record_text";
}

function prettifyKey(keyRaw) {
  const key = String(keyRaw || "").trim();
  if (!key) return "-";
  if (CONTENT_LABEL_MAP[key]) return CONTENT_LABEL_MAP[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (isPlainObject(value)) return Object.values(value).some((item) => hasMeaningfulValue(item));
  return String(value).trim().length > 0;
}

export function hasOverviewContent(content) {
  if (!hasMeaningfulValue(content)) return false;
  const columns = buildOverviewColumns(content);
  return columns.some((col) => {
    if (col.type === "markdown" || col.type === "raw") {
      return hasMeaningfulValue(col.value);
    }
    if (Array.isArray(col.value)) {
      return col.value.some((row) => hasMeaningfulValue(row?.value));
    }
    return hasMeaningfulValue(col.value);
  });
}

function normalizeRows(rowsInput) {
  if (!Array.isArray(rowsInput)) return [];
  return rowsInput.map((row, idx) => {
    if (isPlainObject(row) && ("label" in row || "value" in row)) {
      return { label: row.label ?? `Item ${idx + 1}`, value: row.value };
    }
    if (Array.isArray(row) && row.length >= 2) {
      return { label: row[0], value: row[1] };
    }
    if (isPlainObject(row)) {
      const entries = Object.entries(row);
      if (entries.length === 1) return { label: entries[0][0], value: entries[0][1] };
    }
    return { label: `Item ${idx + 1}`, value: row };
  });
}

function rowsFromObject(obj, valueMapper) {
  if (!isPlainObject(obj)) return [];
  return Object.entries(obj).map(([label, value]) => ({
    label,
    value: valueMapper ? valueMapper(value) : value,
  }));
}

function renderValue(v) {
  if (v == null || v === "") return "-";
  if (isValidElement(v)) return v;
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (v.includes("\n")) {
      return <div className="whitespace-pre-wrap break-words">{v}</div>;
    }
    return v;
  }
  if (Array.isArray(v)) {
    return (
      <ul className="list-disc pl-4 space-y-1">
        {v.map((x, i) => (
          <li key={i}>{typeof x === "string" ? x : safeJson(x)}</li>
        ))}
      </ul>
    );
  }
  if (isPlainObject(v)) {
    return (
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-secondary/30 p-2 text-xs text-muted-foreground">
        {safeJson(v)}
      </pre>
    );
  }
  return String(v);
}

function OverviewCellRows({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="text-sm text-muted-foreground">Tidak ada data.</div>;
  }

  return (
    <dl className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="rounded-[4px] border border-border/50 bg-background/40 p-2.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {prettifyKey(row.label)}
          </dt>
          <dd className="mt-1 text-sm text-foreground">{renderValue(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function OverviewCellMarkdown({ content }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <MarkdownPreview content={content} />
    </div>
  );
}

function buildOverviewColumns(content) {
  const cols = [];

  if (typeof content === "string") {
    const normalizedContent = stripLeadingRecordLabel(content);
    cols.push({
      key: "case-record",
      title: "Catatan Case",
      subtitle: "Ditulis dalam markdown agar instruksi mudah dipindai.",
      type: "markdown",
      value: normalizedContent,
      width: "min-w-[34rem]",
    });
    return cols;
  }

  if (Array.isArray(content?.sections)) {
    let sectionRecordMarkdown = "";
    content.sections.forEach((section, idx) => {
      const rows = normalizeRows(section?.rows);
      const filteredRows = rows.filter((row) => {
        const isRecordRow = isRecordRowLabel(row?.label);
        if (isRecordRow && !sectionRecordMarkdown) {
          sectionRecordMarkdown = stripLeadingRecordLabel(contentAsText(row?.value));
        }
        return !isRecordRow;
      });
      if (filteredRows.length === 0) {
        return;
      }
      cols.push({
        key: `${section?.title || "section"}-${idx}`,
        title: section?.title || `Section ${idx + 1}`,
        subtitle: "",
        type: "rows",
        value: filteredRows,
      });
    });
    if (sectionRecordMarkdown) {
      cols.push({
        key: "case-record-sections-markdown",
        title: "Catatan Case",
        subtitle: "Ditulis dalam markdown agar instruksi mudah dipindai.",
        type: "markdown",
        value: sectionRecordMarkdown,
        width: "min-w-[34rem]",
      });
    }
    return cols;
  }

  if (Array.isArray(content?.rows)) {
    cols.push({
      key: "case-record-rows",
      title: "Data Ringkas",
      subtitle: "",
      type: "rows",
      value: normalizeRows(content.rows),
    });
    return cols;
  }

  if (!isPlainObject(content)) {
    cols.push({
      key: "raw-content",
      title: "Data Ringkas",
      subtitle: "",
      type: "raw",
      value: safeJson(content),
    });
    return cols;
  }

  const checklistRows = rowsFromObject(content.checklist, (value) =>
    typeof value === "boolean" ? (value ? "Ya" : "Tidak") : value
  );
  const metadataRows = Object.entries(content)
    .filter(([key]) => !RESERVED_CONTENT_KEYS.has(canonicalContentKey(key)))
    .map(([label, value]) => ({ label, value }));
  const caseRecordText = stripLeadingRecordLabel(extractCaseRecordText(content));

  if (checklistRows.length > 0) {
    cols.push({
      key: "protocol-checklist",
      title: "Checklist Protokol",
      subtitle: "Konfirmasi kesiapan sebelum workflow dimulai.",
      type: "rows",
      value: checklistRows,
    });
  }

  if (metadataRows.length > 0) {
    cols.push({
      key: "intake-metadata",
      title: "Metadata Intake",
      subtitle: "Konfigurasi tambahan dari payload case record.",
      type: "rows",
      value: metadataRows,
    });
  }

  if (caseRecordText) {
    cols.push({
      key: "case-record-markdown",
      title: "Catatan Case",
      subtitle: "Ditulis dalam markdown agar instruksi mudah dipindai.",
      type: "markdown",
      value: caseRecordText,
      width: "min-w-[34rem]",
    });
  }

  if (cols.length === 0) {
    cols.push({
      key: "fallback",
      title: "Data Ringkas",
      subtitle: "",
      type: "rows",
      value: rowsFromObject(content),
    });
  }

  return cols;
}

export default function ContentTable({ content }) {
  if (!content) return <div className="text-sm text-muted-foreground">Tidak ada konten.</div>;

  const columns = buildOverviewColumns(content);
  const defaultColWidth = "min-w-[21rem]";

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border/70 bg-background">
      <div className="border-b border-border/70 bg-secondary/35 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ringkasan Case
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Struktur kolom menyamping dalam satu tabel. Geser horizontal untuk melihat semua kolom.
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <table
          className="w-full min-w-[980px] table-fixed border-collapse text-sm"
          aria-label="Detail kasus validasi"
        >
          <thead className="bg-secondary/55 [&_th]:whitespace-nowrap">
            <tr>
              {columns.map((col) => (
                <th
                  key={`${col.key}-head`}
                  className={`border-r border-border/70 px-3 py-2.5 text-left align-top last:border-r-0 ${col.width || defaultColWidth}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {col.title}
                  </div>
                  {col.subtitle ? (
                    <div className="mt-1 text-xs font-normal text-muted-foreground">
                      {col.subtitle}
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              {columns.map((col) => (
                <td
                  key={`${col.key}-body`}
                  className="border-r border-border/70 p-3 align-top last:border-r-0"
                >
                  <div className="max-h-[520px] min-h-[220px] overflow-auto">
                    {col.type === "markdown" ? (
                      <OverviewCellMarkdown content={col.value} />
                    ) : col.type === "raw" ? (
                      <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {col.value}
                      </pre>
                    ) : (
                      <OverviewCellRows rows={col.value} />
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
