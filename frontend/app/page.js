import { Suspense } from 'react';
import Hero from '../components/home/Hero';
import CategoryGrid from '../components/home/CategoryGrid';
import LatestThreads from '../components/home/LatestThreads';
import Skeleton from '../components/ui/Skeleton';

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
      {/* Subtle background accent (aman untuk light/dark karena pakai tokens) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-120px] h-[360px] blur-3xl"
        style={{
          background:
            'radial-gradient(600px circle at 50% 0%, rgb(var(--brand) / 0.18), transparent 60%)'
        }}
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-14">
          <Hero />

          <div className="h-px w-full bg-[rgb(var(--border))]" />

          <Suspense fallback={<ListSkeleton />}>
            <LatestThreads />
          </Suspense>

          <div className="h-px w-full bg-[rgb(var(--border))]" />

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
