export default function robots() {
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
          "/components-demo/",
        ],
      },
    ],
    sitemap: "https://aivalid.id/sitemap.xml",
  };
}
