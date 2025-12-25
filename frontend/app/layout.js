import "./globals.css";
import Header from "../components/Header";
import ApiStatusBanner from "../components/ApiStatusBanner";

export const metadata = {
  title: "Alephdraad",
  description: "Community and utilities platform",
  other: { heleket: "a08412d3" },
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
      <body className="min-h-dvh antialiased bg-neutral-50 text-black selection:bg-teal-300 dark:bg-neutral-900 dark:text-white dark:selection:bg-pink-500 dark:selection:text-white">
        <Header />
        <ApiStatusBanner />

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
