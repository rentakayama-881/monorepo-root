import { Paperclip } from "lucide-react";
import { formatDate } from "./utils";

export default function EvidenceSection({
  evidence,
  phase,
  isOpen,
  showForm,
  onToggleForm,
  evidenceDescription,
  onEvidenceDescriptionChange,
  evidenceUrl,
  onEvidenceUrlChange,
  onAddEvidence,
  processing,
}) {
  if (phase !== "evidence" && phase !== "admin_review") return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Evidence</h3>
        {isOpen && phase === "evidence" && (
          <button onClick={onToggleForm} className="text-sm text-primary hover:underline">
            + Add Evidence
          </button>
        )}
      </div>

      {/* Add Evidence Form */}
      {showForm && (
        <form onSubmit={onAddEvidence} className="border-b border-border p-4 space-y-3">
          <textarea
            value={evidenceDescription}
            onChange={(e) => onEvidenceDescriptionChange(e.target.value)}
            placeholder="Describe your evidence..."
            rows={3}
            className="w-full rounded-lg border border-border bg-transparent px-4 py-2 focus:outline-none focus:border-primary"
          />
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => onEvidenceUrlChange(e.target.value)}
            placeholder="Evidence file URL (optional)"
            className="w-full rounded-lg border border-border bg-transparent px-4 py-2 focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onToggleForm} className="px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing || !evidenceDescription.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Submit Evidence
            </button>
          </div>
        </form>
      )}

      <div className="p-4 space-y-3">
        {evidence?.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">No evidence submitted yet</div>
        ) : (
          evidence?.map((ev) => (
            <div key={ev.id} className="rounded-lg bg-background border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">{ev.username}</span>
                <span className="text-xs text-muted-foreground">{formatDate(ev.createdAt)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{ev.description}</p>
              {ev.fileUrl && (
                <a
                  href={ev.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Paperclip className="h-4 w-4" />
                  View Attachment
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
