import { Suspense } from "react";
import SetPinContent from "./SetPinContent";

function SetPinSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="animate-pulse">
          <div className="h-16 w-16 rounded-full bg-border mx-auto mb-4" />
          <div className="h-8 w-48 bg-border rounded mx-auto mb-2" />
          <div className="h-4 w-64 bg-border rounded mx-auto mb-8" />
          <div className="h-64 bg-border rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function SetPinPage() {
  return (
    <Suspense fallback={<SetPinSkeleton />}>
      <SetPinContent />
    </Suspense>
  );
}
