import BadgeDetailClient from "./BadgeDetailClient";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return {
    title: "Detail Badge",
    description: "Lihat detail badge pengguna di AIValid.",
    alternates: {
      canonical: `https://aivalid.id/badge/${id}`,
    },
  };
}

export default function BadgeDetailPage({ params }) {
  return <BadgeDetailClient params={params} />;
}
