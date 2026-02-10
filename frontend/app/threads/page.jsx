import { redirect } from "next/navigation";

export const metadata = {
  title: "My Validation Cases",
};

export default function ThreadsRedirectPage() {
  redirect("/account/validation-cases");
}

