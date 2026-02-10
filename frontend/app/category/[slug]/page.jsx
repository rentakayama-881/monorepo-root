import { redirect } from "next/navigation";

export default function CategoryLegacyRedirectPage() {
  // Legacy route from the old category-based navigation model.
  // The platform now uses a single Validation Case Index (registry).
  redirect("/validation-cases");
}

