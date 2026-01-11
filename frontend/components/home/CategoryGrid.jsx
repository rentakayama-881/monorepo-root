import Link from 'next/link';
import { Card } from '../ui/Card';
import { fetchCategories } from '../../lib/categories';

export default async function CategoryGrid() {
  const categories = await fetchCategories({ next: { revalidate: 60 } });

  const primaryCategory = categories[0];
  const href = primaryCategory ? `/category/${primaryCategory.slug}` : '/threads';

  return (
    <div className="mb-2">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Kategori
        </h2>

        <Link
          href={href}
          className="text-sm font-medium text-primary hover:opacity-90"
        >
          Lihat semua →
        </Link>
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/category/${cat.slug}`} className="block h-full">
              <Card className="flex h-full items-center justify-center p-6 text-center hover:border-muted-foreground transition-colors">
                <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  {cat.name}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
          Kategori belum tersedia.
        </div>
      )}
    </div>
  );
}
