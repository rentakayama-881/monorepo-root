export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/api/",
          "/sync-token/",
          "/verify-email/",
          "/reset-password/",
          "/forgot-password/",
          "/set-username/",
          "/login/",
          "/register/",
          "/validation-cases/new",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
