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
    // Section utama. HANYA padding dan lebar max. 
    // TIDAK ADA border atau background color di sini agar menyatu dengan layout global.
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* 1. Hero muncul instan (karena statis) */}
      <Hero />

      {/* 2. Kategori loading terpisah (ada efek skeleton) */}
      <Suspense fallback={
        <div className="mb-16">
           <div className="flex justify-between mb-6">
             <Skeleton className="h-8 w-32" />
             <Skeleton className="h-8 w-24" />
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
           </div>
        </div>
      }>
        <CategoryGrid />
      </Suspense>

      {/* 3. Thread loading terpisah */}
      <Suspense fallback={
        <div className="mb-12">
           <div className="flex justify-between mb-6">
             <Skeleton className="h-8 w-40" />
             <Skeleton className="h-8 w-24" />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
           </div>
        </div>
      }>
        <LatestThreads />
      </Suspense>

    </section>
  );
}

