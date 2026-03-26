export function formatDate(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function statusLabel(statusRaw) {
  const s = String(statusRaw || "")
    .toLowerCase()
    .trim();
  if (!s) return "Tidak diketahui";
  const map = {
    open: "Terbuka",
    waiting_owner_response: "Menunggu Respons Owner",
    on_hold_owner_inactive: "Ditahan (Owner Tidak Aktif)",
    offer_accepted: "Penawaran Diterima",
    funds_locked: "Dana Dikunci",
    artifact_submitted: "Artefak Dikirim",
    completed: "Selesai",
    disputed: "Disengketakan",
  };
  return map[s] || s.replace(/_/g, " ");
}

export function statusStyle(statusRaw) {
  const s = String(statusRaw || "")
    .toLowerCase()
    .trim();
  switch (s) {
    case "completed":
      return "border-status-success-border bg-status-success-bg text-status-success-text";
    case "disputed":
      return "border-status-danger-border bg-status-danger-bg text-status-danger-text";
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
    case "open":
    default:
      return "border-border bg-card text-foreground";
  }
}

export function sensitivityText(levelRaw) {
  const level =
    String(levelRaw || "S1")
      .toUpperCase()
      .trim() || "S1";
  const labels = {
    S0: "Publik",
    S1: "Terbatas",
    S2: "Rahasia",
    S3: "Kritis",
  };

  if (labels[level]) return `${level} ${labels[level]}`;
  return level;
}

export function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${statusStyle(status)}`}
      role="status"
      aria-label={`Status: ${statusLabel(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}
