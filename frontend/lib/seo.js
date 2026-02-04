/**
 * SEO Utilities
 * Helper functions for generating SEO metadata and structured data
 */

/**
 * Generate JSON-LD structured data for a thread
 * @param {Object} thread - Thread data
 * @returns {Object} - JSON-LD object
 */
export function generateThreadStructuredData(thread) {
  if (!thread) return null;

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: thread.title,
    text: thread.content || thread.description,
    author: {
      "@type": "Person",
      name: thread.author?.username || thread.author_name || "Anonymous",
    },
    datePublished: thread.created_at,
    dateModified: thread.updated_at || thread.created_at,
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: thread.reply_count || 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: thread.upvotes || 0,
      },
    ],
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
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id"}/logo/light-mode.svg`,
    },
    sameAs: [],
  };
}

/**
 * Generate JSON-LD structured data for website
 * @returns {Object} - JSON-LD object
 */
export function generateWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AIvalid",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id"}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
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
