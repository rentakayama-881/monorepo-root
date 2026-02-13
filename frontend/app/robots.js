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
          "/components-demo/",
          "/validation-cases/new",
          "/documents/upload",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
