import { CheckCircle } from "lucide-react";

function formatAmount(amount) {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function normalizeStatus(status) {
  return String(status || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function getStatusColor(status) {
  switch (normalizeStatus(status)) {
    case "open":
      return "border-warning/20 bg-warning/10 text-warning";
    case "underreview":
      return "border-primary/20 bg-primary/10 text-primary";
    case "waitingforevidence":
      return "border-border bg-accent text-accent-foreground";
    case "resolved":
      return "border-success/20 bg-success/10 text-success";
    case "cancelled":
      return "border-border bg-muted/60 text-muted-foreground";
    default:
      return "border-border bg-muted/60 text-muted-foreground";
  }
}

function getStatusLabel(status) {
  switch (normalizeStatus(status)) {
    case "open":
      return "Awaiting Review";
    case "underreview":
      return "Under Review";
    case "waitingforevidence":
      return "Additional Evidence Required";
    case "resolved":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function getCategoryLabel(category) {
  if (category === "ItemNotReceived") return "Item Not Received";
  if (category === "ItemNotAsDescribed") return "Not as Described";
  if (category === "Fraud") return "Suspected Fraud";
  if (category === "SellerNotResponding") return "Seller Not Responding";
  return "Other";
}

export default function DisputeTimeline({ dispute, disputeId, isInitiator }) {
  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`inline-flex items-center rounded-sm border px-3 py-1 text-xs font-medium ${getStatusColor(dispute?.status)}`}
            >
              {getStatusLabel(dispute?.status)}
            </span>
            <span className="text-xs text-muted-foreground">#{disputeId?.slice(-8)}</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Issue: {getCategoryLabel(dispute?.category)}
          </h2>
          <p className="text-sm text-muted-foreground">{dispute?.reason}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            Rp {formatAmount(dispute?.amount || 0)}
          </div>
          <div className="text-xs text-muted-foreground">Funds in escrow</div>
        </div>
      </div>

      {/* Parties */}
      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Buyer (Fund Sender)</div>
          <div className="font-medium text-foreground">
            @{isInitiator ? dispute?.initiatorUsername : dispute?.respondentUsername}
            {isInitiator ? " (You)" : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Seller (Fund Recipient)</div>
          <div className="font-medium text-foreground">
            @{isInitiator ? dispute?.respondentUsername : dispute?.initiatorUsername}
            {!isInitiator ? " (You)" : ""}
          </div>
        </div>
      </div>

      {/* Resolution */}
      {dispute?.resolution && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="flex items-center gap-2 text-success font-medium mb-2">
              <CheckCircle className="w-5 h-5" />
              Admin Decision
            </div>
            <p className="text-sm text-foreground">
              {dispute.resolution.type === "FullRefundToSender" &&
                `IDR ${formatAmount(dispute.resolution.refundToSender)} refunded to the buyer.`}
              {dispute.resolution.type === "FullReleaseToReceiver" &&
                `IDR ${formatAmount(dispute.resolution.releaseToReceiver)} released to the seller.`}
              {dispute.resolution.type === "Split" &&
                `Funds split: IDR ${formatAmount(dispute.resolution.refundToSender)} to the buyer, IDR ${formatAmount(dispute.resolution.releaseToReceiver)} to the seller.`}
              {dispute.resolution.type === "NoAction" &&
                "Transaction continues under the standard hold period."}
            </p>
            {dispute.resolution.note && (
              <p className="text-xs text-muted-foreground mt-2">Note: {dispute.resolution.note}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
