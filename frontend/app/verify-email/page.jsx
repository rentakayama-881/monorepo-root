import { Suspense } from "react";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import VerifyEmailClient from "./VerifyEmailClient";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthPageLoading fullPage={false} message="Loading verify email" />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
