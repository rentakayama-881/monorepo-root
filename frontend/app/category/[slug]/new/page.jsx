import { redirect } from "next/navigation";

export default function CategoryLegacyCreateRedirectPage() {
  // Legacy route from the old category-based intake flow.
  redirect("/validation-cases/new");
}

