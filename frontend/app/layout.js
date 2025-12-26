import "./globals.css";
import Header from "../components/Header";
import ApiStatusBanner from "../components/ApiStatusBanner";
import { ToastProvider } from "../components/ui/Toast";

const siteName = "AlephDraad";
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
  authors: [{ name: "AlephDraad Team" }],
  creator: "AlephDraad",
  publisher: "AlephDraad",
  
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
  
  // Icons
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
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
      <body className="min-h-dvh antialiased bg-[rgb(var(--bg))] text-[rgb(var(--fg))] selection:bg-[rgb(var(--brand))]/30">
        <ToastProvider>
          <Header />
          <ApiStatusBanner />

          <main className="flex-1">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
