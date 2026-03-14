import { formatDate } from "./disputeHelpers";

export default function EvidenceSection({ evidence }) {
  if (!evidence?.length) return null;

  return (
    <div className="mt-6 bg-card rounded-lg border border-border p-6">
      <h3 className="font-semibold text-foreground mb-4">Bukti yang Dilampirkan</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {evidence.map((ev, idx) => (
          <a
            key={idx}
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-border p-3 hover:border-primary transition"
          >
            <div className="text-3xl mb-2">
              {ev.type === "image" ? "🖼️" : ev.type === "document" ? "📄" : "📸"}
            </div>
            <div className="text-sm font-medium text-foreground truncate">
              {ev.description || `Bukti ${idx + 1}`}
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(ev.uploadedAt)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
