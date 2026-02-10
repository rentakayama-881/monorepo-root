import NewValidationCaseClient from "./NewValidationCaseClient";

export const metadata = {
  title: "Create Validation Case",
  description: "Susun Validation Case Record dengan bounty dan kriteria yang dapat diaudit.",
};

export default async function NewValidationCasePage() {
  return <NewValidationCaseClient />;
}
