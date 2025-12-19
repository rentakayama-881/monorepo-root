import Link from "next/link";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { fetchCategories } from "../../lib/categories"; 

export default async function CategoryGrid() {
  // Logic fetch data dipindah ke sini (Server Component)
  const categories = await fetchCategories({ next: { revalidate: 60 } });
  
  const primaryCategory = categories[0];
  const primaryCategoryHref = primaryCategory ? `/category/${primaryCategory.slug}` : "/threads";

  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Kategori</h2>
        <Button href={primaryCategoryHref} variant="outline" className="text-sm">Lihat semua →</Button>
      </div>
      
      {categories.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(cat => (
            <Link key={cat.slug} href={`/category/${cat.slug}`} className="block h-full">
              {/* Card Style:
                  - Light: Putih, hover abu sangat muda
                  - Dark: Hitam, hover abu sangat gelap
              */}
              <Card className="flex h-full items-center justify-center p-6 text-center transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900">
                {/* FIX: Tambahkan dark:text-neutral-100 supaya teks jadi putih di mode gelap */}
                <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                  {cat.name}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-neutral-500 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-800">
          Kategori belum tersedia.
        </div>
      )}
    </div>
  );
}

