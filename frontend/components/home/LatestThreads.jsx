import Link from "next/link";
import { getApiBase } from "../../lib/api";
import ThreadCard, { ThreadCardList } from "../ui/ThreadCard";

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
        <ThreadCardList>
          {threads.map((th) => (
            <ThreadCard
              key={th.id}
              thread={th}
              variant="list"
            />
          ))}
        </ThreadCardList>
      ) : (
        <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-8 text-center text-sm text-[rgb(var(--muted))]">
          Belum ada thread terbaru.
        </div>
      )}
    </section>
  );
}

