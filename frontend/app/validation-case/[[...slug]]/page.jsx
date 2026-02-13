import { redirect } from "next/navigation";

export default async function LegacyValidationCaseRoute({ params, searchParams }) {
  const segments = Array.isArray(params?.slug) ? params.slug.filter(Boolean) : [];
  const path = segments.length > 0 ? `/${segments.map((s) => encodeURIComponent(String(s))).join("/")}` : "";
  const query = new URLSearchParams(searchParams || {}).toString();
  const suffix = query ? `?${query}` : "";
  redirect(`/validation-cases${path}${suffix}`);
}
