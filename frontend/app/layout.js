import "./globals.css";
import Header from "../components/Header";

export const metadata = {
  title: "Ballerina",
  description: "Community and utilities platform",
  other: { heleket: "a08412d3" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased min-h-dvh">
        <Header />
        <main className="pt-16 min-h-screen px-3 py-7 sm:py-10 bg-white max-w-6xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
