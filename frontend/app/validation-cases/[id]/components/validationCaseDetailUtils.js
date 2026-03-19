/**
 * Utility functions for Validation Case Detail page.
 * Extracted from ValidationCaseDetailClient.jsx for modularity.
 */

import { formatIDR } from "@/lib/format";

export function formatHoldWindow(hours) {
  const h = Number(hours || 0);
  if (!Number.isFinite(h) || h <= 0) return "-";
  if (h === 32) return "1 hari 8 jam";
  if (h % 24 === 0) return `${h / 24} hari`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  if (d > 0) return `${d} hari ${rem} jam`;
  return `${h} jam`;
}

export function isSyntheticArtifactMarker(documentIdRaw) {
  const documentId = String(documentIdRaw || "").trim();
  if (!documentId) return false;
  return documentId.startsWith("artifact-submission-auto-");
}

export function normalizeStatus(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

export function statusBadgeClass(statusRaw) {
  const s = normalizeStatus(statusRaw);
  switch (s) {
    case "open":
      return "border-border bg-card text-foreground";
    case "completed":
      return "border-status-success-border bg-status-success-bg text-status-success-text";
    case "disputed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "on_hold_owner_inactive":
      return "border-status-orange-border bg-status-orange-bg text-status-orange-text";
    case "waiting_owner_response":
      return "border-status-info-border bg-status-info-bg text-status-info-text";
    case "funds_locked":
      return "border-status-amber-border bg-status-amber-bg text-status-amber-text";
    case "artifact_submitted":
      return "border-status-sky-border bg-status-sky-bg text-status-sky-text";
    case "offer_accepted":
      return "border-status-violet-border bg-status-violet-bg text-status-violet-text";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
}

export function statusLabel(statusRaw) {
  const s = normalizeStatus(statusRaw);
  if (!s) return "Unknown";
  const map = {
    open: "Open",
    waiting_owner_response: "Waiting Owner Response",
    on_hold_owner_inactive: "On Hold (Owner Inactive)",
    offer_accepted: "Offer Accepted",
    funds_locked: "Funds Locked",
    artifact_submitted: "Artifact Submitted",
    completed: "Completed",
    disputed: "Disputed",
  };
  return map[s] || s.replace(/_/g, " ");
}

export function workflowSummaryLabel(
  statusRaw,
  { artifactId = "", transferId = "", acceptedFinalOfferId = 0 } = {}
) {
  const s = normalizeStatus(statusRaw);
  if (s === "completed") return "Completed";
  if (s === "disputed") return "Disputed";
  if (s === "on_hold_owner_inactive") return "On Hold (Owner Inactive)";
  if (s === "waiting_owner_response") return "Waiting Owner Response";
  if (artifactId) return "Artifact Submitted";
  if (transferId) return "Funds Locked";
  if (acceptedFinalOfferId) return "Offer Accepted";
  return "Open";
}

export function consultationStatusLabel(statusRaw) {
  const s = normalizeStatus(statusRaw);
  if (!s) return "-";
  const map = {
    pending: "Pending Owner Review",
    approved: "Approved",
    rejected: "Rejected",
    waiting_owner_response: "Waiting Owner Response",
    owner_timeout: "Owner Timeout",
  };
  return map[s] || s.replace(/_/g, " ");
}

export function sensitivityMeta(levelRaw) {
  const level = String(levelRaw || "S1").toUpperCase();
  switch (level) {
    case "S0":
      return {
        level: "S0",
        label: "Publik",
        badgeClass: "border-success/30 bg-success/10 text-success",
      };
    case "S1":
      return {
        level: "S1",
        label: "Terbatas",
        badgeClass: "border-primary/30 bg-primary/10 text-primary",
      };
    case "S2":
      return {
        level: "S2",
        label: "Rahasia",
        badgeClass: "border-warning/30 bg-warning/10 text-warning",
      };
    case "S3":
      return {
        level: "S3",
        label: "Kritis",
        badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      };
    default:
      return {
        level: level || "-",
        label: "Tidak diketahui",
        badgeClass: "border-border bg-secondary text-foreground",
      };
  }
}

export function contentAsText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content);
}

export function stripLeadingRecordLabel(markdownRaw) {
  const markdown = String(markdownRaw || "").replace(/^\uFEFF/, "");
  const stripped = markdown.replace(/^\s*(?:#{1,6}\s*)?record\s*:?\s*(?:\r?\n)+/i, "");
  return stripped.trimStart();
}

export function looksLikeMarkdownText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|!\[[^\]]*]\(|\|.+\|)/.test(text);
}

export function formatCaseLogLoadError(err, ownerView = false) {
  if (err?.status === 401) {
    return "Sesi berakhir. Silakan login kembali untuk membuka Case Log.";
  }
  if (err?.status === 403) {
    return ownerView
      ? "Akses Case Log ditolak. Pastikan akun yang login adalah pemilik case ini."
      : "Case Log hanya tersedia untuk pemilik kasus atau validator yang telah disetujui.";
  }
  return err?.message || "Case Log belum bisa dimuat saat ini.";
}

export function resolveTelegramContactHref(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (/^tg:\/\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  const username = value.replace(/^@/, "").trim();
  if (!username) return "";
  return `https://t.me/${username}`;
}

export function formatTelegramContactLabel(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  const tgIdMatch = value.match(/^tg:\/\/user\?id=(\d+)$/i);
  if (tgIdMatch) {
    return `Buka Aplikasi Telegram (ID: ${tgIdMatch[1]})`;
  }
  return value;
}

export function caseLogEventLabel(eventTypeRaw) {
  const eventType = normalizeStatus(eventTypeRaw);
  const labels = {
    consultation_requested: "Permintaan konsultasi diajukan.",
    consultation_approved: "Permintaan konsultasi disetujui.",
    consultation_rejected: "Permintaan konsultasi ditolak.",
    owner_clarification_submitted: "Pemilik kasus memberikan klarifikasi.",
    assumption_mode_submitted: "Asumsi kerja diajukan untuk persetujuan pemilik kasus.",
    case_status_changed: "Status kasus diperbarui.",
    case_resumed_from_owner_inactive: "Kasus dibuka kembali setelah respons pemilik diterima.",
    owner_response_sla_reminder: "Pengingat respons dikirim ke pemilik kasus.",
    owner_response_sla_expired: "Batas waktu respons pemilik kasus telah berakhir.",
    validator_released_without_penalty: "Validator dilepas tanpa penalti.",
    contact_revealed: "Kontak privat dibuka untuk pihak terkait.",
    final_offer_submitted: "Final offer diajukan oleh validator.",
    final_offer_accepted: "Final offer diterima oleh pemilik kasus.",
    funds_locked: "Dana berhasil dikunci di escrow.",
    artifact_submitted: "Hasil validasi telah diserahkan.",
    escrow_released_confirmed: "Dana escrow telah dirilis.",
    certified_artifact_issued: "Sertifikasi artefak diterbitkan.",
    dispute_attached: "Dispute diajukan.",
    dispute_settled: "Dispute telah diselesaikan oleh admin.",
    workflow_cycle_incremented: "Siklus workflow dilanjutkan ke tahap berikutnya.",
    financial_linkage_cleared: "Keterkaitan finansial sebelumnya telah dibersihkan.",
  };
  return labels[eventType] || "Aktivitas kasus diperbarui.";
}

export function sensitivityStakeRequirement(level, bountyAmount) {
  if (level === "S0") return "S0: tanpa minimum stake";
  if (level === "S1") return "S1: minimal stake Rp 100.000";
  if (level === "S2") return "S2: minimal stake Rp 500.000";
  if (level === "S3")
    return `S3: minimal stake sama dengan bounty case (${formatIDR(bountyAmount)})`;
  return "Stake mengikuti kebijakan default";
}
