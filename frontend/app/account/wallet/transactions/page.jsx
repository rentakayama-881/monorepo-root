import { Suspense } from "react";
import TransactionsContent from "./TransactionsContent";

function TransactionsSkeleton() {
  return (
    <main className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="h-8 w-48 bg-border rounded mb-2" />
              <div className="h-4 w-32 bg-border rounded" />
            </div>
            <div className="h-10 w-28 bg-border rounded-lg" />
          </div>
          <div className="h-20 bg-border rounded-lg mb-6" />
          <div className="h-10 bg-border rounded mb-4" />
          <div className="space-y-3">
            <div className="h-24 bg-border rounded-lg" />
            <div className="h-24 bg-border rounded-lg" />
            <div className="h-24 bg-border rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsContent />
    </Suspense>
  );
}
