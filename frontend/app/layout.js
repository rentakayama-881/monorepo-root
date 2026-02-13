import "./globals.css";
import Script from "next/script";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ApiStatusBanner from "../components/ApiStatusBanner";
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
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "AIValid - Platform Validasi Hasil AI Indonesia",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/images/og-image.png"],
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
	    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
	    shortcut: "/favicon.svg",
	    apple: "/logo/light-mode.png",
	  },

  // Manifest
  manifest: "/manifest.json",

  // Other
  other: {
    heleket: "a08412d3",
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
];

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-dvh flex-col antialiased bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">{`
(() => {
  const root = document.documentElement;

  // Disable transitions for the very first theme application to avoid a visible
  // light->dark animation on refresh.
  root.classList.add("theme-init");

  try {
    let pref = null;
    try {
      pref = localStorage.getItem("theme");
    } catch (_) {}

    const resolved =
      pref === "light" || pref === "dark"
        ? pref
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  } catch (_) {
    // Never block rendering if theme init fails.
  } finally {
    // Re-enable transitions after the initial sync theme is applied.
    setTimeout(() => {
      root.classList.remove("theme-init");
      root.style.backgroundColor = "";
    }, 0);
  }
})();
        `}</Script>

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

                  <div id="main-content" role="main" tabIndex={-1} className="flex-1 pt-0 md:pt-[var(--header-height)]">
                    {children}
                  </div>

                  <Footer />

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
