import ValidationCaseDetailClient from "./ValidationCaseDetailClient";
import { fetchCasePublic, unwrapValidationCase } from "./casePublicData";
import { generateValidationCaseStructuredData, generateBreadcrumbStructuredData } from "@/lib/seo";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await fetchCasePublic(id);
  const vc = unwrapValidationCase(data);

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
  const vc = unwrapValidationCase(data);

  const jsonLd = vc?.title ? generateValidationCaseStructuredData(vc) : null;
  const breadcrumbJsonLd = generateBreadcrumbStructuredData([
    { name: "Beranda", url: "https://aivalid.id" },
    { name: "Kasus Validasi", url: "https://aivalid.id/validation-cases" },
    { name: vc?.title || "Detail Kasus", url: `https://aivalid.id/validation-cases/${id}` },
  ]);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <ValidationCaseDetailClient initialCaseData={data || null} />
    </>
  );
}
