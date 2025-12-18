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
      {/* Tambah 'antialiased' biar font lebih tajam ala Vercel */}
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">
        <Header />
        
        {/* PERUBAHAN DISINI: 
            1. Saya hapus <div> pembungkus yang punya border/bg-white.
            2. Main saya biarkan polos, cuma ngatur jarak dari Header (pt).
        */}
        <main className="pt-[4.5rem] min-h-screen">
            {children}
        </main>
      </body>
    </html>
  );
}

