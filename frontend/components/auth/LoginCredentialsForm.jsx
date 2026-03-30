import Link from "next/link";
import ApiErrorAlert from "@/components/ApiErrorAlert";
import PasskeyLoginButton from "@/components/auth/PasskeyLoginButton";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthContainer,
  AuthField,
  AuthHeader,
  AuthNotice,
} from "@/components/auth/AuthPrimitives";

export default function LoginCredentialsForm({
  email,
  password,
  loading,
  error,
  passkeyLoading,
  webAuthnSupported,
  sessionExpired,
  registeredNotice,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onPasskeyLogin,
}) {
  return (
    <AuthContainer>
      <AuthHeader
        title="Selamat datang kembali"
        description="Masuk untuk melanjutkan ke workspace AIValid Anda."
      />

      {sessionExpired ? (
        <AuthNotice variant="warning">Sesi Anda telah berakhir. Silakan masuk kembali.</AuthNotice>
      ) : null}

      {registeredNotice ? (
        <AuthNotice variant="success">
          Pendaftaran berhasil. Periksa inbox Anda dan verifikasi email sebelum masuk.
        </AuthNotice>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <AuthField label="Email" htmlFor="login-email">
          <input
            id="login-email"
            data-testid="login-email-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className={AUTH_INPUT_CLASS}
            placeholder="name@example.com"
          />
        </AuthField>

        <AuthField label="Password" htmlFor="login-password">
          <input
            id="login-password"
            data-testid="login-password-input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className={AUTH_INPUT_CLASS}
            placeholder="••••••••"
          />
        </AuthField>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Lupa kata sandi?
          </Link>
        </div>

        <ApiErrorAlert error={error} className="mb-2" />

        <button
          type="submit"
          data-testid="login-submit-button"
          disabled={loading}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {loading ? "Masuk..." : "Masuk"}
        </button>
      </form>

      {webAuthnSupported ? (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          <PasskeyLoginButton
            loading={passkeyLoading}
            disabled={loading}
            onClick={onPasskeyLogin}
          />
        </>
      ) : null}

      <div className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-foreground underline">
          Buat akun
        </Link>
      </div>
    </AuthContainer>
  );
}
