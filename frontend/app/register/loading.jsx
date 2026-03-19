import AuthPageLoading from "@/components/auth/AuthPageLoading";

export default function RegisterLoading() {
  return (
    <AuthPageLoading fullPage={false} className="auth-page-bg" message="Memuat formulir daftar" />
  );
}
