import { normalizeStatus, getStatusLabel } from "./disputeHelpers";

export default function StatusUpdateCard({ dispute, onStatusUpdate }) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="font-semibold text-foreground mb-4">Ubah Status</h2>
      <div className="space-y-2">
        {["UnderReview", "WaitingForEvidence"].map((status) => (
          <button
            key={status}
            onClick={() => onStatusUpdate(status)}
            disabled={normalizeStatus(dispute.status) === normalizeStatus(status)}
            className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition ${
              normalizeStatus(dispute.status) === normalizeStatus(status)
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-card border border-border hover:border-primary"
            }`}
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>
    </div>
  );
}
