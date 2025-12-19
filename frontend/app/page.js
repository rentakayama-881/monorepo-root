import { Suspense } from 'react';
import Hero from '../components/home/Hero';
import CategoryGrid from '../components/home/CategoryGrid';
import LatestThreads from '../components/home/LatestThreads';
import Skeleton from '../components/ui/Skeleton';

export const metadata = {
  title: 'Ballerina - Home',
  description: 'Komunitas digital dan Utilitas Tingkat Tinggi',
};

export default function Home() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      
      <Hero />

      <Suspense fallback={<GridSkeleton />}>
        <CategoryGrid />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <LatestThreads />
      </Suspense>

    </section>
  );
}

// Skeleton Components (Disimpan disini agar file page.js tetap ringkas)
function GridSkeleton() {
  return (
    <div className="mb-12">
      <div className="flex justify-between mb-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mb-10">
      <div className="flex justify-between mb-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    </div>
  );
}

