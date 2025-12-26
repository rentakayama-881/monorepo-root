import { Suspense } from "react";
import Header from "@/components/Header";
import SetPinContent from "./SetPinContent";

function SetPinSkeleton() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="animate-pulse">
          <div className="h-16 w-16 rounded-full bg-[rgb(var(--border))] mx-auto mb-4" />
          <div className="h-8 w-48 bg-[rgb(var(--border))] rounded mx-auto mb-2" />
          <div className="h-4 w-64 bg-[rgb(var(--border))] rounded mx-auto mb-8" />
          <div className="h-64 bg-[rgb(var(--border))] rounded-lg" />
        </div>
      </div>
    </main>
  );
}

export default function SetPinPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<SetPinSkeleton />}>
        <SetPinContent />
      </Suspense>
    </>
  );
}
