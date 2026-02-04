import { Suspense } from "react";
import Hero from "../components/home/Hero";
import HowItWorks from "../components/home/HowItWorks";
import FocusAreas from "../components/home/FocusAreas";
import CategoryGrid from "../components/home/CategoryGrid";
import LatestThreads from "../components/home/LatestThreads";
import Skeleton from "../components/ui/Skeleton";

export const metadata = {
  title: "Beranda",
  description:
    "AIvalid - Platform validasi hasil kerja berbasis AI dengan bantuan validator manusia dari berbagai bidang.",
  openGraph: {
    title: "AIvalid - Validasi Hasil AI",
    description:
      "Buat thread, jelaskan konteks, dan dapatkan review terstruktur dari validator sesuai bidangnya.",
  },
};

export default function Home() {
  return (
    <div className="relative">
      <Hero />

      <section className="container py-12 md:py-16">
        <div className="flex flex-col gap-12">
          <HowItWorks />

          <FocusAreas />

          <div id="latest" className="scroll-mt-16">
            <Suspense fallback={<ListSkeleton />}>
              <LatestThreads />
            </Suspense>
          </div>

          <div className="h-px w-full bg-border" />

          <div id="categories" className="scroll-mt-16">
            <Suspense fallback={<GridSkeleton />}>
              <CategoryGrid />
            </Suspense>
          </div>
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
