import "./globals.css";
import Header from "../components/Header";
import FooterGate from "../components/FooterGate";
import ApiStatusBanner from "../components/ApiStatusBanner";
import CookieConsentBanner from "../components/CookieConsentBanner";
import { ToastProvider } from "../components/ui/Toast";
import { SudoProvider } from "../components/SudoModal";
import Providers from "../components/Providers";
import { ThemeProvider } from "../lib/ThemeContext";
import { CommandPaletteProvider } from "../components/CommandPaletteProvider";
import GlobalKeyboardShortcuts from "../components/GlobalKeyboardShortcuts";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  generateOrganizationStructuredData,
  generateWebsiteStructuredData,
  generateWebApplicationStructuredData,
} from "../lib/seo";

const siteName = "AIValid - Validasi Hasil AI oleh Ahli Manusia";
const siteDescription =
  "Platform validasi hasil kerja AI #1 di Indonesia. Cek keaslian dan kualitas tugas, riset, kode program, dan dokumen buatan AI oleh validator ahli.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | AIValid`,
  },
  description: siteDescription,
  keywords: [
    "validasi AI",
    "cek hasil AI",
    "validasi kode AI",
    "cek tugas AI",
    "validasi riset AI",
    "review dokumen AI",
    "validator manusia",
    "platform validasi Indonesia",
    "cek keaslian AI",
    "AIValid",
  ],
  authors: [{ name: "AIvalid Team" }],
  creator: "AIvalid",
  publisher: "AIvalid",

  // Open Graph
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: siteUrl,
    siteName: "AIValid",
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/logo/light-mode.png",
        width: 1024,
        height: 1024,
        alt: "AIValid - Platform Validasi Hasil AI Indonesia",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/logo/light-mode.png"],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Icons - AIvalid
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon-32.png",
    apple: "/logo/light-mode.png",
  },

  // Manifest
  manifest: "/manifest.json",

  alternates: {
    canonical: siteUrl,
  },

  // Other
  other: {
    heleket: "a08412d3",
    "apple-mobile-web-app-title": "AIvalid",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const jsonLd = [
  generateOrganizationStructuredData(),
  generateWebsiteStructuredData(),
  generateWebApplicationStructuredData(),
];

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Preload critical fonts to prevent FOUT (text size jump) */}
        <link
          rel="preload"
          href="/fonts/ibm-plex/sans/IBMPlexSans-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ibm-plex/sans/IBMPlexSans-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ibm-plex/sans/IBMPlexSans-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ibm-plex/sans/IBMPlexSans-SemiBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Synchronous theme init — must run before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add("theme-init");try{var t=null;try{t=localStorage.getItem("theme")}catch(e){}var r=t==="light"||t==="dark"?t:window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";d.classList.remove("light","dark");d.classList.add(r)}catch(e){}requestAnimationFrame(function(){requestAnimationFrame(function(){d.classList.remove("theme-init")})})})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased bg-background text-foreground">

        {/* Skip to main content link for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <ThemeProvider>
          <Providers>
            <CommandPaletteProvider>
              <ToastProvider>
                <SudoProvider>
                  <Header />
                  <ApiStatusBanner />

                  <div id="main-content" role="main" tabIndex={-1} className="flex-1 pt-[var(--header-height)]">
                    {children}
                  </div>

                  <FooterGate />
                  <CookieConsentBanner />

                  <SpeedInsights />
                  {/* Global keyboard shortcuts handler */}
                  <GlobalKeyboardShortcuts />
                </SudoProvider>
              </ToastProvider>
            </CommandPaletteProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
