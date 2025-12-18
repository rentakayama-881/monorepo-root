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

  const cardClass = "rounded-lg border border-neutral-200 bg-white p-5 shadow-sm";
  const buttonPrimary =
    "inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
  const buttonSecondary =
    "inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
  const subtleLink = "text-sm font-medium text-neutral-900 underline";

  return (
    <section className="mx-auto max-w-5xl">
      {/* Hero Section */}
      <div className="mb-10 flex flex-col items-start gap-8 md:flex-row md:items-center">
        <div className="flex-1">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900">
            Platform komunitas dan utilitas digital yang rapi
          </h1>
          <p className="mb-4 max-w-2xl text-base text-neutral-700">
            Temukan thread, kategori, dan fitur komunitas yang dirancang ringkas. Semua tampilan kini lebih tajam dan profesional di berbagai perangkat.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/threads" className={buttonPrimary}>Lihat Semua Thread</Link>
            <Link href={primaryCategoryHref} className={buttonSecondary}>
              Kategori Utama
            </Link>
          </div>
        </div>
        <div className="hidden flex-1 items-center justify-end pr-4 md:flex">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
            <Image src="/images/vectorised-1758374067909.svg" alt="Community" width={180} height={180} priority />
          </div>
        </div>
      </div>

      {/* Kategori Grid */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">Kategori</h2>
          <Link href={primaryCategoryHref} className={subtleLink}>Lihat semua kategori →</Link>
        </div>
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`${cardClass} font-semibold text-neutral-900 hover:bg-neutral-50`}
              >
                <span className="font-semibold text-base text-slate-900">{cat.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-600">Kategori belum tersedia.</div>
        )}
      </div>

      {/* Thread Terbaru */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">Thread Terbaru</h2>
          <Link href="/threads" className={subtleLink}>Lihat semua threads →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threads.length > 0 ? (
            threads.map(th => {
              const createdAt = formatDate(th.created_at);
              return (
                <Link key={th.id} href={`/thread/${th.id}`} className={`${cardClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900`}>
                  <div className="mb-1 text-base font-semibold leading-tight text-neutral-900">{th.title}</div>
                  <div className="mb-3 text-sm leading-relaxed text-neutral-700">{th.summary}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    <span>By <span className="font-semibold">{th.username || "Anonim"}</span></span>
                    {createdAt && <span>•</span>}
                    {createdAt && <span>{createdAt}</span>}
                    {th.category && (
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-800">
                        {th.category.name || th.category.slug}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-xs font-medium text-neutral-900">Lihat detail →</div>
                  <p className="mt-2 text-xs text-neutral-600">Login diperlukan untuk melihat detail thread.</p>
                </Link>
              );
            })
          ) : (
            <div className="text-sm text-neutral-600">Belum ada thread terbaru.</div>
          )}
        </div>
      </div>

      {/* Info & Aturan */}
      <div className="mb-2 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <h3 className="mb-2 text-base font-semibold text-neutral-900">Aturan & Etika</h3>
        <ul className="ml-6 space-y-1 text-sm text-neutral-700 list-disc">
          <li>Tidak boleh posting SARA, spam, penipuan, atau konten ilegal.</li>
          <li>Gunakan bahasa yang sopan dan saling menghormati.</li>
          <li>Laporkan thread/akun bermasalah ke admin.</li>
        </ul>
        <div className="mt-2">
          <Link href="/rules-content" className={subtleLink}>Baca aturan lengkap →</Link>
        </div>
      </div>
    </section>
  );
}
