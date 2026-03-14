function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DisputeEvidence({ evidence }) {
  if (!evidence?.length) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-6 mt-6">
      <h3 className="font-semibold text-foreground mb-4">Submitted Evidence</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
              {ev.description || `Evidence ${idx + 1}`}
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(ev.uploadedAt)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
