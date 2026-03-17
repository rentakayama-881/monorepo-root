import { formatDateShortTime } from "@/lib/format";

export { formatDateShortTime as formatDate };

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
