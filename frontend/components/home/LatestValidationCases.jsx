import Link from "next/link";
import { getApiBase } from "../../lib/api";
import { formatIDR } from "@/lib/format";
import { Clock, ArrowRight, MessageCircle } from "lucide-react";
import logger from "@/lib/logger";

async function getLatestValidationCases() {
  const API = getApiBase();
  try {
    const res = await fetch(`${API}/api/v1/validation-cases/latest?limit=6`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { cases: [], error: true };
    const data = await res.json();
    return {
      cases: Array.isArray(data.validation_cases) ? data.validation_cases : [],
      error: false,
    };
  } catch (err) {
    logger.error("Failed to fetch latest validation cases", err);
    return { cases: [], error: true };
  }
}

function formatDate(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLES = {
  open: "bg-success/15 text-success border-success/30",
  completed: "bg-primary/10 text-primary border-primary/30",
  disputed: "bg-destructive/10 text-destructive border-destructive/30",
};

export default async function LatestValidationCases() {
  const { cases, error } = await getLatestValidationCases();

  return (
    <section
      className="mb-12"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="size-5 text-primary" aria-hidden="true" />
          Case Validasi Terbaru
        </h2>
        <Link
          href="/validation-cases"
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline transition-all hover:gap-2"
        >
          Lihat Semua
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {error && cases.length === 0 && (
        <p className="mb-3 text-xs text-muted-foreground" role="status">
          Tidak dapat memuat case terbaru.
        </p>
      )}

      {cases.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((vc) => {
            const statusLower = String(vc.status || "").toLowerCase();
            const statusColorClass =
              STATUS_STYLES[statusLower] || "bg-secondary text-muted-foreground border-border";

            return (
              <Link
                key={String(vc.id)}
                href={`/validation-cases/${encodeURIComponent(String(vc.id))}`}
                prefetch={false}
                className="group block rounded-[var(--radius)] border bg-background p-4 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {vc.title}
                  </span>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusColorClass}`}
                  >
                    {String(vc.status || "unknown")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatIDR(vc.bounty_amount)}
                  </span>
                  <span className="text-border">|</span>
                  <span>{formatDate(vc.created_at)}</span>
                </div>
                {Array.isArray(vc.tags) && vc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vc.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.slug || tag.name}
                        className="inline-flex rounded-sm bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {tag.name || tag.slug}
                      </span>
                    ))}
                    {vc.tags.length > 3 && (
                      <span className="inline-flex rounded-sm bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        +{vc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed bg-background py-12 text-center">
          <MessageCircle
            className="mx-auto size-12 text-muted-foreground opacity-50"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-muted-foreground font-medium">
            Belum ada case validasi terbaru.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kasus akan muncul di sini setelah intake.
          </p>
        </div>
      )}
    </section>
  );
}
