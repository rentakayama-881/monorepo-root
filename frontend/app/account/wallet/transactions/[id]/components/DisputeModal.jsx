import NativeSelect from "@/components/ui/NativeSelect";

// Dispute categories matching backend
const DISPUTE_CATEGORIES = [
  { value: "ItemNotReceived", label: "Item/Service Not Received" },
  { value: "ItemNotAsDescribed", label: "Item/Service Not as Described" },
  { value: "Fraud", label: "Suspected Fraud" },
  { value: "SellerNotResponding", label: "Seller Not Responding" },
  { value: "Other", label: "Other Reason" },
];

export default function DisputeModal({
  disputeCategory,
  disputeReason,
  error,
  processing,
  onCategoryChange,
  onReasonChange,
  onConfirm,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-lg bg-card p-6 my-8">
        <h3 className="text-lg font-bold text-foreground mb-4">Request Mediation Support</h3>
        <div className="text-sm text-muted-foreground mb-4">
          <p>Describe the issue clearly so our team can assist effectively.</p>
        </div>

        {/* Category Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Issue Category <span className="text-destructive">*</span>
          </label>
          <NativeSelect
            value={disputeCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="h-12 rounded-lg px-4"
          >
            <option value="">-- Select Category --</option>
            {DISPUTE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Reason Textarea */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Describe the Issue <span className="text-destructive">*</span>
          </label>
          <textarea
            value={disputeReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Describe the issue in detail (minimum 20 characters)..."
            rows={4}
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-foreground focus:outline-none focus:border-primary resize-none"
          />
          <div
            className={`text-xs mt-1 ${disputeReason.length >= 20 ? "text-success" : "text-muted-foreground"}`}
          >
            {disputeReason.length}/20 minimum characters {disputeReason.length >= 20 ? "✓" : ""}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !disputeCategory || disputeReason.length < 20}
            className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {processing ? "Processing..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
