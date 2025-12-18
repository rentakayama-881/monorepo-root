import Link from "next/link";
import Image from "next/image";
import { fetchCategories } from "../lib/categories";
import { getApiBase } from "../lib/api";

// Import komponen UI (Pastikan file ini ada di components/ui/)
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
    // PERBAIKAN DI SINI:
    // Saya hapus border/shadow di section utama ini.
    // Jadi halaman paling bawah akan bersih (putih/polos), tidak ada garis dobel.
    <section className="mx-auto max-w-5xl px-4 py-10">
      
      {/* --- HERO SECTION --- */}
      <div className="mb-16 flex flex-col items-start gap-10 md:flex-row md:items-center">
        <div className="flex-1">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
            Platform komunitas dan utilitas digital yang rapi
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
            Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas. Semua tampilan kini lebih tajam dan profesional.
          </p>
          <div className="flex flex-wrap gap-4">
            {/* Tombol Navigasi: Border tetap ada (diurus oleh komponen Button) */}
            <Button href="/threads" variant="primary">Lihat Semua Thread</Button>
            <Button href={primaryCategoryHref} variant="secondary">Kategori Utama</Button>
          </div>
        </div>
        
        {/* Gambar Vector */}
        <div className="hidden flex-1 items-center justify-end md:flex">
          <Image 
            src="/images/vectorised-1758374067909.svg" 
            alt="Community Vector" 
            width={280} 
            height={280} 
            priority
            className="dark:opacity-80"
          />
        </div>
      </div>

      {/* --- KATEGORI GRID --- */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Kategori</h2>
          <Button href={primaryCategoryHref} variant="outline" className="text-sm">Lihat semua →</Button>
        </div>
        
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <Link key={cat.slug} href={`/category/${cat.slug}`} className="block h-full">
                {/* Card Kategori: Border halus tetap ada (bawaan Card.jsx) */}
                <Card className="flex h-full items-center justify-center p-6 text-center hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <span className="font-semibold text-base text-neutral-900 dark:text-white">
                    {cat.name}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-100 dark:bg-neutral-900 dark:border-neutral-800">
            Kategori belum tersedia.
          </div>
        )}
      </div>

      {/* --- THREAD TERBARU --- */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Thread Terbaru</h2>
          <Button href="/threads" variant="outline" className="text-sm">Lihat semua →</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threads.length > 0 ? (
            threads.map(th => (
              <Link key={th.id} href={`/thread/${th.id}`} className="block h-full">
                {/* Card Thread: Border halus tetap ada, hover biru tetap ada */}
                <Card className="flex h-full flex-col justify-between p-5">
                  <div>
                    <h3 className="mb-2 text-lg font-semibold leading-tight text-neutral-900 dark:text-white">
                        {th.title}
                    </h3>
                    <p className="mb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-2">
                        {th.summary}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-medium text-neutral-900 dark:text-neutral-200">
                        {th.username || "Anonim"}
                    </span>
                    <span>•</span>
                    <span>{formatDate(th.created_at)}</span>
                    {th.category && (
                      <>
                        <span>•</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {th.category.name || th.category.slug}
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              </Link>
            ))
          ) : (
             <div className="py-10 text-center text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-100 dark:bg-neutral-900 dark:border-neutral-800">
               Belum ada thread terbaru.
             </div>
          )}
        </div>
      </div>

      {/* Bagian bawah (Footer Area) KOSONG. 
          Tidak ada div 'Aturan' lagi, jadi border jelek di bawah otomatis hilang. */}

    </section>
  );
}

