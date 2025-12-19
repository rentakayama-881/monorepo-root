import Link from "next/link";
import Card from "../ui/Card";
import { fetchCategories } from "../../lib/categories";

export default async function CategoryGrid() {
  // Logic fetch ada di dalam komponen (Vercel Style)
  const categories = await fetchCategories({ next: { revalidate: 60 } });
  
  // Logic link "Lihat Semua"
  const primaryCategory = categories[0];
  const href = primaryCategory ? `/category/${primaryCategory.slug}` : "/threads";

  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Kategori</h2>
        <Link href={href} className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
          Lihat semua →
        </Link>
      </div>
      
      {categories.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(cat => (
            <Link key={cat.slug} href={`/category/${cat.slug}`} className="block h-full">
              <Card className="flex h-full items-center justify-center p-6 text-center hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <span className="font-semibold text-base">
                  {cat.name}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-slate-500 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
          Kategori belum tersedia.
        </div>
      )}
    </div>
  );
}

