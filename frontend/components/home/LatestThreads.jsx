import Link from "next/link";
import Card from "../ui/Card";
import { getApiBase } from "../../lib/api";

async function getLatestThreads() {
  const API = getApiBase();
  try {
    const res = await fetch(`${API}/api/threads/latest?limit=6`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.threads) ? data.threads : [];
  } catch (err) {
    return [];
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default async function LatestThreads() {
  const threads = await getLatestThreads();

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[rgb(var(--fg))]">Thread Terbaru</h2>
        <Link href="/threads" className="text-sm font-medium text-[rgb(var(--brand))] hover:underline">
          Lihat semua →
        </Link>
      </div>
      
      {threads.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          {threads.map((th, idx) => (
            <Link
              key={th.id}
              href={`/thread/${th.id}`}
              className={`block p-4 transition-colors hover:bg-[rgb(var(--surface-2))] ${idx !== threads.length - 1 ? "border-b border-[rgb(var(--border))]" : ""}`}
            >
              <h3 className="text-base font-semibold text-[rgb(var(--fg))]">
                {th.title}
              </h3>
              {th.summary && (
                <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--muted))]">
                  {th.summary}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <span className="font-medium text-[rgb(var(--fg))]">
                  {th.username || "Anonim"}
                </span>
                <span>•</span>
                <span>{formatDate(th.created_at)}</span>
                {th.category && (
                  <>
                    <span>•</span>
                    <span className="rounded-full bg-[rgb(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
                      {th.category.name || th.category.slug}
                    </span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-8 text-center text-sm text-[rgb(var(--muted))]">
          Belum ada thread terbaru.
        </div>
      )}
    </section>
  );
}

