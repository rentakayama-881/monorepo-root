import { Suspense } from "react";
import ValidationCaseDetailClient from "./ValidationCaseDetailClient";
import ValidationCaseRecordSkeleton from "./ValidationCaseRecordSkeleton";
import { generateValidationCaseStructuredData } from "@/lib/seo";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://api.aivalid.id";

async function fetchCasePublic(id) {
  try {
    const res = await fetch(`${API_BASE}/api/validation-cases/${id}/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await fetchCasePublic(id);
  const vc = data?.validation_case || data;

  if (!vc?.title) {
    return {
      title: "Kasus Validasi",
      description: "Detail kasus validasi AI di AIValid.",
    };
  }

  const description =
    vc.summary ||
    `Kasus validasi "${vc.title}" — lihat detail, status, dan hasil review oleh validator ahli di AIValid.`;

  return {
    title: vc.title,
    description: description.slice(0, 160),
    alternates: {
      canonical: `https://aivalid.id/validation-cases/${id}`,
    },
    openGraph: {
      title: vc.title,
      description: description.slice(0, 160),
      type: "article",
      url: `https://aivalid.id/validation-cases/${id}`,
    },
  };
}

export default async function ValidationCaseDetailPage({ params }) {
  const { id } = await params;
  const data = await fetchCasePublic(id);
  const vc = data?.validation_case || data;

  const jsonLd = vc?.title ? generateValidationCaseStructuredData(vc) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense fallback={<ValidationCaseRecordSkeleton />}>
        <ValidationCaseDetailClient />
      </Suspense>
    </>
  );
}
