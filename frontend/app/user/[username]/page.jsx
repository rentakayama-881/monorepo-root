import { Suspense } from "react";
import UserProfileClient from "./UserProfileClient";
import UserProfileSkeleton from "./UserProfileSkeleton";
import { generateProfilePageStructuredData } from "@/lib/seo";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://api.aivalid.id";

async function fetchUserPublic(username) {
  try {
    const res = await fetch(`${API_BASE}/api/user/${username}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { username } = await params;
  const data = await fetchUserPublic(username);
  const user = data?.user || data;

  if (!user?.username) {
    return {
      title: "Profil Pengguna",
      description: "Profil pengguna di AIValid.",
    };
  }

  const displayName = user.display_name || user.username;
  const description =
    user.bio ||
    `Profil ${displayName} di AIValid — lihat riwayat validasi dan reputasi.`;

  return {
    title: `${displayName} (@${user.username})`,
    description: description.slice(0, 160),
    alternates: {
      canonical: `https://aivalid.id/user/${user.username}`,
    },
    openGraph: {
      title: `${displayName} — Profil AIValid`,
      description: description.slice(0, 160),
      type: "profile",
      url: `https://aivalid.id/user/${user.username}`,
    },
  };
}

export default async function UserProfilePage({ params }) {
  const { username } = await params;
  const data = await fetchUserPublic(username);
  const user = data?.user || data;

  const jsonLd = user?.username
    ? generateProfilePageStructuredData(user)
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense fallback={<UserProfileSkeleton />}>
        <UserProfileClient />
      </Suspense>
    </>
  );
}
