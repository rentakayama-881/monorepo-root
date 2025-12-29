import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ApiStatusBanner from "../components/ApiStatusBanner";
import { ToastProvider } from "../components/ui/Toast";

const siteName = "Alephdraad";
const siteDescription = "Platform komunitas dan escrow terpercaya untuk transaksi aman antar pengguna di Indonesia.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://alephdraad.fun";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: ["escrow", "transaksi aman", "komunitas", "forum", "Indonesia", "payment"],
  authors: [{ name: "Alephdraad Team" }],
  creator: "Alephdraad",
  publisher: "Alephdraad",
  
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
  
  // Icons - Alephdraad
  icons: {
    icon: [
      { url: "/logo/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/logo/favicon.svg",
    apple: "/logo/logo-icon-only.svg",
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
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col antialiased bg-[rgb(var(--bg))] text-[rgb(var(--fg))] selection:bg-[rgb(var(--brand))]/30">
        <ToastProvider>
          <Header />
          <ApiStatusBanner />

          <main className="flex-1">{children}</main>
          
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
