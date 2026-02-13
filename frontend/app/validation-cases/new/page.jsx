import NewValidationCaseClient from "./NewValidationCaseClient";

export const metadata = {
  title: "Buat Kasus Validasi AI Baru",
  description:
    "Buat kasus validasi baru di AIValid. Kirimkan hasil kerja AI Anda untuk direview oleh validator ahli — kode, riset, tugas, dokumen, atau desain.",
  alternates: {
    canonical: "https://aivalid.id/validation-cases/new",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewValidationCasePage() {
  return <NewValidationCaseClient />;
}
