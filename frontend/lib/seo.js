/**
 * SEO Utilities
 * Helper functions for generating SEO metadata and structured data
 */

/**
 * Generate JSON-LD structured data for a Validation Case
 * @param {Object} validationCase - Validation Case data
 * @returns {Object} - JSON-LD object
 */
export function generateValidationCaseStructuredData(validationCase) {
  if (!validationCase) return null;

  const createdAtUnix = validationCase?.created_at ?? validationCase?.createdAt;
  const createdAt =
    typeof createdAtUnix === "number"
      ? new Date(createdAtUnix * 1000).toISOString()
      : undefined;

  return {
    "@context": "https://schema.org",
    // Not a forum/discussion post. Use a neutral type.
    "@type": "CreativeWork",
    name: validationCase.title,
    description: validationCase.summary || "",
    author: {
      "@type": "Person",
      name: validationCase.owner?.username || "Anonymous",
    },
    dateCreated: createdAt,
  };
}

/**
 * Generate JSON-LD structured data for the organization
 * @returns {Object} - JSON-LD object
 */
export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AIvalid",
    description: "Platform validasi hasil kerja berbasis AI dengan bantuan validator manusia dari berbagai bidang.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id",
    logo: {
      "@type": "ImageObject",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id"}/favicon.svg`,
    },
    sameAs: [],
  };
}

/**
 * Generate JSON-LD structured data for website
 * @returns {Object} - JSON-LD object
 */
export function generateWebsiteStructuredData() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AIvalid",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/validation-cases?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generate JSON-LD structured data for web application.
 * Mirrors prompts.chat pattern: add a stable Software/WebApplication entity.
 * @returns {Object} - JSON-LD WebApplication object
 */
export function generateWebApplicationStructuredData() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AIvalid",
    url: baseUrl,
    description:
      "Platform validasi hasil kerja AI oleh validator ahli manusia dari berbagai bidang.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
    },
    publisher: {
      "@type": "Organization",
      name: "AIvalid",
      url: baseUrl,
    },
  };
}

/**
 * Generate Open Graph metadata
 * @param {Object} params - Page parameters
 * @returns {Object} - Open Graph metadata
 */
export function generateOpenGraphMetadata({
  title,
  description,
  type = "website",
  image = "/images/og-image.png",
  url = "",
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";
  
  return {
    title,
    description,
    type,
    url: `${siteUrl}${url}`,
    siteName: "AIvalid",
    locale: "id_ID",
    images: [
      {
        url: image,
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  };
}

/**
 * Generate Twitter Card metadata
 * @param {Object} params - Page parameters
 * @returns {Object} - Twitter Card metadata
 */
export function generateTwitterMetadata({
  title,
  description,
  image = "/images/og-image.png",
}) {
  return {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  };
}

/**
 * Generate canonical URL
 * @param {string} path - Page path
 * @returns {string} - Canonical URL
 */
export function generateCanonicalUrl(path = "") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";
  return `${siteUrl}${path}`;
}

/**
 * Generate JSON-LD structured data for FAQ pages
 * @param {Array<{question: string, answer: string}>} faqs - Array of FAQ items
 * @returns {Object} - JSON-LD FAQPage object
 */
export function generateFAQStructuredData(faqs) {
  if (!faqs || !faqs.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate JSON-LD structured data for a user profile page
 * @param {Object} user - User data
 * @returns {Object} - JSON-LD ProfilePage object
 */
export function generateProfilePageStructuredData(user) {
  if (!user) return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: user.display_name || user.username,
      url: `${siteUrl}/user/${user.username}`,
      ...(user.bio && { description: user.bio }),
      ...(user.avatar_url && { image: user.avatar_url }),
    },
  };
}
