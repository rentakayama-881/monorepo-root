import { redirect } from "next/navigation";

export const metadata = {
  title: "Validation Case",
  robots: { index: false, follow: false },
};

export default async function ValidationCaseRepoRedirectPage({ params }) {
  const { id } = await params;
  redirect(`/validation-cases/${encodeURIComponent(String(id))}`);
}
