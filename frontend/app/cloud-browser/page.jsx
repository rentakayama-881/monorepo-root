import CloudBrowserClient from "./CloudBrowserClient";

export const metadata = {
  title: "Smart Browser — AIValid",
  description:
    "Cloud anti-detect browser. Kelola profil browser dan akses dari perangkat apa saja.",
  alternates: { canonical: "https://aivalid.id/cloud-browser" },
};

export default function CloudBrowserPage() {
  return (
    <main className="container py-10">
      <CloudBrowserClient />
    </main>
  );
}
