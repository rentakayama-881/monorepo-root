/**
 * Shared dispute display helpers.
 * Pure functions — no React imports, no side-effects.
 */

import { formatDateShortTime, formatCurrency } from "@/lib/format";

export { formatDateShortTime as formatDate, formatCurrency as formatAmount };

export function normalizeStatus(status) {
  return String(status || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function getStatusColor(status) {
  switch (normalizeStatus(status)) {
    case "open":
      return "border-warning/20 bg-warning/10 text-warning";
    case "underreview":
    case "admin_review":
      return "border-primary/20 bg-primary/10 text-primary";
    case "waitingforevidence":
    case "evidence":
      return "border-warning/20 bg-warning/10 text-warning";
    case "resolved":
      return "border-success/20 bg-success/10 text-success";
    case "cancelled":
      return "border-border bg-muted/60 text-muted-foreground";
    default:
      return "border-border bg-muted/60 text-muted-foreground";
  }
}

export function getStatusLabel(status) {
  switch (normalizeStatus(status)) {
    case "open":
      return "Menunggu Review";
    case "underreview":
    case "admin_review":
      return "Sedang Ditinjau";
    case "waitingforevidence":
    case "evidence":
      return "Butuh Bukti";
    case "resolved":
      return "Selesai";
    case "cancelled":
      return "Dibatalkan";
    default:
      return status;
  }
}

export function getCategoryLabel(category) {
  switch (
    String(category || "")
      .replace(/\s+/g, "")
      .toLowerCase()
  ) {
    case "itemnotreceived":
      return "Barang Tidak Diterima";
    case "itemnotasdescribed":
      return "Tidak Sesuai Deskripsi";
    case "fraud":
      return "Dugaan Penipuan";
    case "sellernotresponding":
      return "Penjual Tidak Merespons";
    case "other":
      return "Lainnya";
    default:
      return category;
  }
}

export function getPhaseInfo(phase) {
  const info = {
    negotiation: {
      title: "Negotiation Phase",
      description: "Discuss with the counterparty to find a resolution.",
      containerClass: "bg-warning/10 border border-warning/30",
      titleClass: "text-warning",
    },
    evidence: {
      title: "Evidence Phase",
      description: "Upload supporting evidence for your claim.",
      containerClass: "bg-accent border border-border",
      titleClass: "text-accent-foreground",
    },
    admin_review: {
      title: "Admin Review",
      description: "Our team is currently reviewing this case.",
      containerClass: "bg-primary/10 border border-primary/30",
      titleClass: "text-primary",
    },
  };
  return info[phase] || info.negotiation;
}

export function getResolutionLabel(resolution) {
  const value = String(resolution || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!value) return "Completed";
  if (value.includes("split")) return "Funds Split";
  if (value.includes("refund")) return "Refund to Sender";
  if (value.includes("release")) return "Release to Recipient";
  if (value.includes("noaction")) return "No Action";
  return resolution;
}
