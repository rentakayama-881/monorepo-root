import "./globals.css";
import Header from "../components/Header";
import ApiStatusBanner from "../components/ApiStatusBanner";
import { ToastProvider } from "../components/ui/Toast";

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
