import { normalizeStatus } from "./useTransactionDetail";

const STATUS_STYLES = {
  held: "bg-warning/10 text-warning border-warning/30",
  released: "bg-success/10 text-success border-success/30",
  refunded: "bg-primary/10 text-primary border-primary/30",
  disputed: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted/60 text-muted-foreground border-border",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_LABELS = {
  held: "Funds on Hold",
  released: "Completed",
  refunded: "Refunded",
  disputed: "In Mediation",
  cancelled: "Cancelled",
  rejected: "Rejected by Recipient",
};

export default function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  return (
    <span
      className={`rounded-sm border px-3 py-1 text-sm font-medium ${STATUS_STYLES[normalized] || STATUS_STYLES.held}`}
    >
      {STATUS_LABELS[normalized] || status}
    </span>
  );
}
