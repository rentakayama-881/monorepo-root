"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import InnerSyncTokenPage from "./inner";

export default function SyncTokenPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center p-6 text-sm text-[rgb(var(--muted))]">
        Menyimpan token ke browser...
      </div>
    }>
      <InnerSyncTokenPage />
    </Suspense>
  );
}
