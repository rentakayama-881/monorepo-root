import Link from "next/link";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { getApiBase } from "../../lib/api"; // Path relative naik 2 level

async function getLatestThreads() {
  const API = getApiBase();
  try {
    const res = await fetch(`${API}/api/threads/latest?limit=6`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.threads) ? data.threads : [];
  } catch (err) {
    console.error("Failed to fetch latest threads", err);
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
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Thread Terbaru</h2>
        <Button href="/threads" variant="outline" className="text-sm">Lihat semua →</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {threads.length > 0 ? (
          threads.map(th => (
            <Link key={th.id} href={`/thread/${th.id}`} className="block h-full">
              <Card className="flex h-full flex-col justify-between p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                <div>
                  <h3 className="mb-2 text-lg font-semibold leading-tight text-neutral-900 dark:text-white">
                      {th.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {th.summary}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <span className="font-medium text-neutral-900 dark:text-neutral-300">
                      {th.username || "Anonim"}
                  </span>
                  <span>•</span>
                  <span>{formatDate(th.created_at)}</span>
                  {th.category && (
                    <>
                      <span>•</span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 border border-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800">
                        {th.category.name || th.category.slug}
                      </span>
                    </>
                  )}
                </div>
              </Card>
            </Link>
          ))
        ) : (
           <div className="py-10 text-center text-neutral-500 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-800">
             Belum ada thread terbaru.
           </div>
        )}
      </div>
    </div>
  );
}
