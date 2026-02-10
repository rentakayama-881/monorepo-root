/**
 * Dynamic sitemap generation
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";

export default async function sitemap() {
  // Static pages
  const staticPages = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about-content`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/rules-content`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/contact-support`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];

  // TODO: Fetch dynamic pages from API (validation cases, categories, etc.)
  // const cases = await fetchValidationCasesForSitemap();
  // const casePages = cases.map((vc) => ({
  //   url: `${BASE_URL}/validation-cases/${vc.id}`,
  //   lastModified: new Date(vc.updated_at),
  //   changeFrequency: "weekly",
  //   priority: 0.6,
  // }));

  return [...staticPages];
}
