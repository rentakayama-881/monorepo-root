import { Suspense } from "react";
import Hero from "../components/home/Hero";
import HowItWorks from "../components/home/HowItWorks";
import FocusAreas from "../components/home/FocusAreas";
import LatestValidationCases from "../components/home/LatestValidationCases";
import Skeleton from "../components/ui/Skeleton";
import Footer from "../components/Footer";

export const metadata = {
  title: "Beranda",
  description:
    "AIValid - Validation Protocol untuk hasil kerja berbasis AI: escrow-backed, stake-gated, dan dapat diaudit.",
  openGraph: {
    title: "AIvalid - Validasi Hasil AI",
    description:
      "Buat Validation Case, tetapkan bounty, dan jalankan alur escrow + stake + admin arbitration.",
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
              <LatestValidationCases />
            </Suspense>
          </div>
        </div>
      </section>

      <Footer />
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
