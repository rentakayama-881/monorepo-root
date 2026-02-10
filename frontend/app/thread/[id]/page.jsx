import { redirect } from "next/navigation";

export default function ThreadRedirectPage({ params }) {
  const id = params?.id;
  redirect(`/validation-cases/${encodeURIComponent(String(id || ""))}`);
}

