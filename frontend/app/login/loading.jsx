import AuthPageLoading from "@/components/auth/AuthPageLoading";

export default function LoginLoading() {
  return (
    <AuthPageLoading fullPage={false} className="auth-page-bg" message="Memuat formulir masuk" />
  );
}
