import Link from "next/link";
import Image from "next/image";
import { fetchCategories } from "../lib/categories";
import { getApiBase } from "../lib/api";

// Pastikan file komponen ini ada (Button.jsx & Card.jsx)
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

export const revalidate = 60;

async function fetchLatestThreads() {
  const API = getApiBase();
  try {
    const res = await fetch(`${API}/api/threads/latest?limit=6`, {
      next: { revalidate },
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
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function Home() {
  const [categories, threads] = await Promise.all([
    fetchCategories({ next: { revalidate } }),
    fetchLatestThreads(),
  ]);

  const primaryCategory = categories[0];
  const primaryCategoryHref = primaryCategory
    ? `/category/${primaryCategory.slug}`
    : "/threads";

  return (
    // WRAPPER UTAMA:
    // Disini kita set max-w-5xl supaya konten tetap rapi di tengah.
    // Tapi TIDAK ADA border/bg-white disini. Jadi backgroundnya nyatu sama layout (abu-abu).
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* --- HERO SECTION --- */}
      <div className="mb-14 flex flex-col items-start gap-10 md:flex-row md:items-center">
        <div className="flex-1">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Platform komunitas dan utilitas digital yang rapi
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-neutral-600">
            Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas. Semua tampilan kini lebih tajam dan profesional.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button href="/threads" variant="primary">Lihat Semua Thread</Button>
            <Button href={primaryCategoryHref} variant="secondary">Kategori Utama</Button>
          </div>
        </div>
        
        {/* Gambar Vector */}
        <div className="hidden flex-1 items-center justify-end md:flex">
          {/* Hapus background kotak di gambar biar lebih clean */}
          <div className="p-4"> 
            <Image 
              src="/images/vectorised-1758374067909.svg" 
              alt="Community Vector" 
              width={280} 
              height={280} 
              priority
            />
          </div>
        </div>
      </div>

      {/* --- KATEGORI GRID --- */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900">Kategori</h2>
          <Button href={primaryCategoryHref} variant="outline" className="text-sm">Lihat semua →</Button>
        </div>
        
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <Link key={cat.slug} href={`/category/${cat.slug}`} className="block h-full">
                {/* Card Kategori: Putih di atas background abu-abu layout. Kontras & Cakep! */}
                <Card className="flex h-full items-center justify-center p-6 text-center hover:bg-neutral-50 transition-all">
                  <span className="font-semibold text-base text-neutral-900">
                    {cat.name}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-neutral-500 rounded-lg border border-dashed border-neutral-300">
            Kategori belum tersedia.
          </div>
        )}
      </div>

      {/* --- THREAD TERBARU --- */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900">Thread Terbaru</h2>
          <Button href="/threads" variant="outline" className="text-sm">Lihat semua →</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threads.length > 0 ? (
            threads.map(th => (
              <Link key={th.id} href={`/thread/${th.id}`} className="block h-full">
                <Card className="flex h-full flex-col justify-between p-5 hover:border-neutral-300 transition-colors">
                  <div>
                    <h3 className="mb-2 text-lg font-semibold leading-tight text-neutral-900">
                        {th.title}
                    </h3>
                    <p className="mb-4 text-sm leading-relaxed text-neutral-600 line-clamp-2">
                        {th.summary}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-900">
                        {th.username || "Anonim"}
                    </span>
                    <span>•</span>
                    <span>{formatDate(th.created_at)}</span>
                    {th.category && (
                      <>
                        <span>•</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 border border-neutral-200">
                          {th.category.name || th.category.slug}
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              </Link>
            ))
          ) : (
             <div className="py-10 text-center text-neutral-500 rounded-lg border border-dashed border-neutral-300">
               Belum ada thread terbaru.
             </div>
          )}
        </div>
      </div>

    </section>
  );
}

