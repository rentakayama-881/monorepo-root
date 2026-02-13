/**
 * Dynamic sitemap generation
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://api.aivalid.id";
export const revalidate = 3600;

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
      url: `${BASE_URL}/fees`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/community-guidelines`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/validation-cases`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/threads`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Category landing pages
  const categories = [
    "coding",
    "riset-ilmiah",
    "tugas-kuliah",
    "dokumen",
    "ui-ux",
    "keamanan",
  ];
  const categoryPages = categories.map((slug) => ({
    url: `${BASE_URL}/validasi/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Dynamic validation cases
  let casePages = [];
  try {
    const res = await fetch(`${API_BASE}/api/validation-cases/latest?limit=50`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const cases = Array.isArray(data?.validation_cases)
        ? data.validation_cases
        : [];
      casePages = cases.map((vc) => ({
        url: `${BASE_URL}/validation-cases/${vc.id}`,
        lastModified: vc.updated_at
          ? new Date(
              typeof vc.updated_at === "number"
                ? vc.updated_at * 1000
                : vc.updated_at
            )
          : new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));
    }
  } catch {
    // Fail silently — don't break the build
  }

  return [...staticPages, ...categoryPages, ...casePages];
}
