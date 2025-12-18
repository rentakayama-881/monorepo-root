import "./globals.css";
import Header from "../components/Header";

export const metadata = {
  title: "Ballerina",
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
    <html lang="id">
      <body className="antialiased min-h-dvh bg-slate-50 text-slate-900">
        <Header />
        <main className="pt-[4.25rem] min-h-screen px-4 pb-12 sm:px-6">
          <div className="mx-auto max-w-6xl bg-white rounded-xl border border-slate-200 shadow-sm px-4 sm:px-8 py-8 sm:py-10">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
