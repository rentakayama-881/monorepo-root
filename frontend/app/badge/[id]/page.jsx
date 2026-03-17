import BadgeDetailClient from "./BadgeDetailClient";

export const metadata = {
  title: "Detail Badge",
  description: "Lihat detail badge pengguna di AIValid.",
};

export default function BadgeDetailPage({ params }) {
  return <BadgeDetailClient params={params} />;
}
