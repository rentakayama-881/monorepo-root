import { Suspense } from 'react';
import Hero from '../components/home/Hero';
import CategoryGrid from '../components/home/CategoryGrid';
import LatestThreads from '../components/home/LatestThreads';
import Skeleton from '../components/ui/Skeleton';
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata = {
  title: 'Beranda',
  description: 'Alephdraad - Platform komunitas dan escrow terpercaya untuk transaksi aman antar pengguna di Indonesia.',
  openGraph: {
    title: 'Alephdraad - Komunitas & Escrow Terpercaya',
    description: 'Platform komunitas dan escrow terpercaya untuk transaksi aman antar pengguna di Indonesia.',
  },
};

export default function Home() {
  return (
    <div className="relative">
      <Hero />

      <section className="container py-12">
        <div className="flex flex-col gap-14">
          <Suspense fallback={<ListSkeleton />}>
            <LatestThreads />
          </Suspense>

          <div className="h-px w-full bg-border" />

          <Suspense fallback={<GridSkeleton />}>
            <CategoryGrid />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

// Skeleton Components (biar page.js tetap ringkas)
function GridSkeleton() {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
