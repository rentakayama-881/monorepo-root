import "./globals.css";
import { Inter, Geist_Mono, Aref_Ruqaa } from "next/font/google";
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

const arefRuqaa = Aref_Ruqaa({
  weight: ["400", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-aref-ruqaa", // Kita buat variable CSS-nya
  display: "swap",
});

// Load fonts (prompts.chat style)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteName = "AIvalid";
const siteDescription = "Platform validasi hasil kerja berbasis AI dengan bantuan validator manusia dari berbagai bidang.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aivalid.id";
export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: ["escrow", "transaksi aman", "komunitas", "forum", "Indonesia", "payment"],
  authors: [{ name: "AIvalid Team" }],
  creator: "AIvalid",
  publisher: "AIvalid",
  
  // Open Graph
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: siteUrl,
    siteName: siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: siteName,
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

export default function RootLayout({ children }) {
  const htmlClassName = `${inter.variable} ${geistMono.variable} ${arefRuqaa.variable}`.trim();

  return (
    <html lang="id" suppressHydrationWarning className={htmlClassName}>
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

    // Prevent the white flash before CSS loads by setting an immediate background.
    // Once CSS is loaded, body uses var(--background) and takes over.
    root.style.backgroundColor = resolved === "dark" ? "#0b1026" : "#ffffff";
  } catch (_) {
    // Never block rendering if theme init fails.
  } finally {
    // Re-enable transitions after the initial sync theme is applied.
    setTimeout(() => root.classList.remove("theme-init"), 0);
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

                  <div id="main-content" role="main" tabIndex={-1} className="flex-1 pt-[var(--header-height)]">
                    {children}
                  </div>
                  
                  <Footer />
                  <SpeedInsights />                  
                  {/* Global keyboard shortcuts handler */}
                  <GlobalKeyboardShortcuts />
                  
                  {/* Back to top button - REMOVED as per design requirements */}
                </SudoProvider>
              </ToastProvider>
            </CommandPaletteProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
