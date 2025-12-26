import { Suspense } from "react";
import Header from "@/components/Header";
import TransactionsContent from "./TransactionsContent";

function TransactionsSkeleton() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="h-8 w-48 bg-[rgb(var(--border))] rounded mb-2" />
              <div className="h-4 w-32 bg-[rgb(var(--border))] rounded" />
            </div>
            <div className="h-10 w-28 bg-[rgb(var(--border))] rounded-lg" />
          </div>
          <div className="h-20 bg-[rgb(var(--border))] rounded-lg mb-6" />
          <div className="h-10 bg-[rgb(var(--border))] rounded mb-4" />
          <div className="space-y-3">
            <div className="h-24 bg-[rgb(var(--border))] rounded-lg" />
            <div className="h-24 bg-[rgb(var(--border))] rounded-lg" />
            <div className="h-24 bg-[rgb(var(--border))] rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function TransactionsPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsContent />
      </Suspense>
    </>
  );
}
