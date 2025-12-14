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
    <section className="max-w-6xl mx-auto px-4 py-10">
      {/* Hero Section */}
      <div className="mb-10 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-black mb-3">
            Platform Komunitas, Diskusi, & Utilitas Digital
          </h1>
          <p className="text-lg text-neutral-700 mb-4">
            Temukan thread, kategori, relasi, dan fitur digital untuk pengembangan diri dan komunitas.
          </p>
          <div className="flex gap-4 mt-2">
            <Link href="/threads" className="btn">Lihat Semua Thread</Link>
            <Link href={primaryCategoryHref} className="btn bg-neutral-100 text-black hover:bg-neutral-200">
              Kategori Utama
            </Link>
          </div>
        </div>
        <div className="flex-1 hidden md:flex justify-center items-center">
          <Image src="/images/vectorised-1758374067909.svg" alt="Community" width={220} height={220} priority />
        </div>
      </div>

      {/* Kategori Grid */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-black">Kategori</h2>
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {categories.map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="card hover:shadow-lg transition border-neutral-200"
              >
                <span className="font-semibold text-lg text-black">{cat.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-neutral-500">Kategori belum tersedia.</div>
        )}
        <div className="mt-4 text-right">
          <Link href={primaryCategoryHref} className="text-blue-700 underline hover:text-blue-900">
            Lihat semua kategori →
          </Link>
        </div>
      </div>

      {/* Thread Terbaru */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-4 text-black">Thread Terbaru</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {threads.length > 0 ? (
            threads.map(th => {
              const createdAt = formatDate(th.created_at);
              return (
                <Link key={th.id} href={`/thread/${th.id}`} className="card hover:shadow-xl transition border-neutral-200 p-5">
                  <div className="font-semibold text-lg text-black mb-1">{th.title}</div>
                  <div className="text-neutral-700 text-sm mb-2">{th.summary}</div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                    <span>By <span className="font-semibold">{th.username || "Anonim"}</span></span>
                    {createdAt && <span>•</span>}
                    {createdAt && <span>{createdAt}</span>}
                    {th.category && (
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded-full text-[11px] font-semibold">
                        {th.category.name || th.category.slug}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-blue-700 text-xs font-medium">Lihat detail →</div>
                  <p className="text-xs text-neutral-500 mt-2">Login diperlukan untuk melihat detail thread.</p>
                </Link>
              );
            })
          ) : (
            <div className="text-neutral-500">Belum ada thread terbaru.</div>
          )}
        </div>
        <div className="mt-4 text-right">
          <Link href="/threads" className="text-blue-700 underline hover:text-blue-900">Lihat semua threads →</Link>
        </div>
      </div>

      {/* Info & Aturan */}
      <div className="mb-12 bg-neutral-50 border border-neutral-200 rounded-lg p-5">
        <h3 className="text-lg font-bold mb-2 text-black">Aturan & Etika</h3>
        <ul className="list-disc ml-6 text-neutral-700 space-y-1 text-sm">
          <li>Tidak boleh posting SARA, spam, penipuan, atau konten ilegal.</li>
          <li>Gunakan bahasa yang sopan dan saling menghormati.</li>
          <li>Laporkan thread/akun bermasalah ke admin.</li>
        </ul>
        <div className="mt-2">
          <Link href="/rules-content" className="text-blue-700 underline hover:text-blue-900 text-sm">Baca aturan lengkap →</Link>
        </div>
      </div>
    </section>
  );
}
