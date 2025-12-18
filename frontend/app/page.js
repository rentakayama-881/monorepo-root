import Link from "next/link";
import Image from "next/image";
import { fetchCategories } from "../lib/categories";
import { getApiBase } from "../lib/api";

export const revalidate = 60;

async function fetchLatestThreads() {
  const API = getApiBase();
  try {
    const res = await fetch(`${API}/api/threads/latest?limit=6`, {
      next: { revalidate },
    });
    if (!res.ok) {
      return [];
    }
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
    <section className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="mb-10 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2 tracking-tight">
            Platform komunitas dan utilitas digital yang rapi
          </h1>
          <p className="text-base text-slate-600 mb-4 max-w-2xl">
            Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas. Semua tampilan kini lebih tajam dan profesional di berbagai perangkat.
          </p>
          <div className="flex gap-3 mt-2 flex-wrap">
            <Link href="/threads" className="btn text-sm">Lihat Semua Thread</Link>
            <Link href={primaryCategoryHref} className="btn btn-secondary text-sm">
              Kategori Utama
            </Link>
          </div>
        </div>
        <div className="flex-1 hidden md:flex justify-end items-center pr-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
            <Image src="/images/vectorised-1758374067909.svg" alt="Community" width={200} height={200} priority />
          </div>
        </div>
      </div>

      {/* Kategori Grid */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Kategori</h2>
          <Link href={primaryCategoryHref} className="text-sm text-blue-700 hover:text-blue-900">Lihat semua kategori →</Link>
        </div>
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="card hover:shadow-md transition border-slate-200"
              >
                <span className="font-semibold text-base text-slate-900">{cat.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">Kategori belum tersedia.</div>
        )}
      </div>

      {/* Thread Terbaru */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Thread Terbaru</h2>
          <Link href="/threads" className="text-sm text-blue-700 hover:text-blue-900">Lihat semua threads →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threads.length > 0 ? (
            threads.map(th => {
              const createdAt = formatDate(th.created_at);
              return (
                <Link key={th.id} href={`/thread/${th.id}`} className="card hover:shadow-md transition border-slate-200 p-5">
                  <div className="font-semibold text-base text-slate-900 mb-1 line-clamp-2">{th.title}</div>
                  <div className="text-slate-600 text-sm mb-3 line-clamp-3">{th.summary}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span>By <span className="font-semibold">{th.username || "Anonim"}</span></span>
                    {createdAt && <span>•</span>}
                    {createdAt && <span>{createdAt}</span>}
                    {th.category && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-[11px] font-semibold">
                        {th.category.name || th.category.slug}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-blue-700 text-xs font-medium">Lihat detail →</div>
                  <p className="text-xs text-slate-500 mt-2">Login diperlukan untuk melihat detail thread.</p>
                </Link>
              );
            })
          ) : (
            <div className="text-slate-500 text-sm">Belum ada thread terbaru.</div>
          )}
        </div>
      </div>

      {/* Info & Aturan */}
      <div className="mb-2 bg-slate-50 border border-slate-200 rounded-lg p-5">
        <h3 className="text-base font-semibold mb-2 text-slate-900">Aturan & Etika</h3>
        <ul className="list-disc ml-6 text-slate-700 space-y-1 text-sm">
          <li>Tidak boleh posting SARA, spam, penipuan, atau konten ilegal.</li>
          <li>Gunakan bahasa yang sopan dan saling menghormati.</li>
          <li>Laporkan thread/akun bermasalah ke admin.</li>
        </ul>
        <div className="mt-2">
          <Link href="/rules-content" className="text-blue-700 hover:text-blue-900 text-sm">Baca aturan lengkap →</Link>
        </div>
      </div>
    </section>
  );
}
