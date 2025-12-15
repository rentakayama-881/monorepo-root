import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Memuat…</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
