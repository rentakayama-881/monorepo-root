import Link from "next/link";
import ApiErrorAlert from "@/components/ApiErrorAlert";
import PasskeyLoginButton from "@/components/auth/PasskeyLoginButton";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthCard,
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
        title="Welcome back"
        description="Sign in to continue to your AIvalid workspace."
      />

      <AuthCard>
        {sessionExpired ? (
          <AuthNotice variant="warning" className="mb-4">
            Your session has expired. Please sign in again.
          </AuthNotice>
        ) : null}

        {registeredNotice ? (
          <AuthNotice variant="success" className="mb-4">
            Registration successful. Check your inbox and verify your email before signing in.
          </AuthNotice>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <AuthField label="Email" htmlFor="login-email">
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              className={AUTH_INPUT_CLASS}
              placeholder="name@example.com"
            />
          </AuthField>

          <AuthField label="Password" htmlFor="login-password">
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className={AUTH_INPUT_CLASS}
              placeholder="••••••••"
            />
          </AuthField>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>

          <ApiErrorAlert error={error} className="mb-2" />

          <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASS}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {webAuthnSupported ? (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <PasskeyLoginButton loading={passkeyLoading} disabled={loading} onClick={onPasskeyLogin} />
          </>
        ) : null}
      </AuthCard>

      <div className="text-center text-sm text-muted-foreground">
        New to AIvalid?{" "}
        <Link href="/register" className="font-medium text-foreground underline">
          Create an account
        </Link>
      </div>
    </AuthContainer>
  );
}
