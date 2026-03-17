/**
 * Pure display helpers for dispute detail page.
 * No side-effects, no React imports — safe to import from any file.
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
      return "border-primary/20 bg-primary/10 text-primary";
    case "waitingforevidence":
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
      return "Sedang Ditinjau";
    case "waitingforevidence":
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
