import Link from "next/link";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { fetchCategories } from "../../lib/categories"; // Path relative naik 2 level

export default async function CategoryGrid() {
  // Teknik Vercel: Fetch data langsung di sini
  const categories = await fetchCategories({ next: { revalidate: 60 } });
  
  // Ambil kategori pertama buat link (opsional logic)
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
              <Card className="flex h-full items-center justify-center p-6 text-center hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all">
                {/* dark:text-white sudah dipasang agar aman di mode gelap */}
                <span className="font-semibold text-base text-neutral-900 dark:text-white">
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

