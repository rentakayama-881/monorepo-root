import Link from "next/link";
import { getApiBase } from "../../lib/api";
import ThreadCard from "../ui/ThreadCard";

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
    <section className="mb-12 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Thread Terbaru
        </h2>
        <Link 
          href="/threads" 
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline transition-all hover:gap-2"
        >
          Lihat semua
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"></path>
          </svg>
        </Link>
      </div>
      
      {threads.length > 0 ? (
        <div className="space-y-4">
          {threads.map((th) => (
            <ThreadCard
              key={th.id}
              thread={th}
              variant="default"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed bg-card py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          <p className="mt-3 text-sm text-muted-foreground font-medium">Belum ada thread terbaru.</p>
          <p className="mt-1 text-xs text-muted-foreground">Thread akan muncul di sini begitu ada yang dibuat.</p>
        </div>
      )}
    </section>
  );
}

