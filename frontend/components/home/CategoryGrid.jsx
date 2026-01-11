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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 stagger-children">
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/category/${cat.slug}`} className="block h-full group">
              <Card className="flex h-full items-center justify-center p-6 text-center transition-all hover:border-primary hover:shadow-md hover:scale-105 active:scale-100">
                <div className="flex flex-col items-center gap-2">
                  {/* Icon placeholder - you can add actual icons here */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                  {/* Post count badge if available */}
                  {cat.thread_count !== undefined && (
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                      {cat.thread_count} thread
                    </span>
                  )}
                </div>
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
