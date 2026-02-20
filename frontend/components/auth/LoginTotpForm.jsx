import ApiErrorAlert from "@/components/ApiErrorAlert";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthCard,
  AuthContainer,
  AuthField,
  AuthHeader,
} from "@/components/auth/AuthPrimitives";

export default function LoginTotpForm({
  useBackupCode,
  totpCode,
  loading,
  error,
  onSubmit,
  onBackToLogin,
  onToggleCodeType,
  onTotpCodeChange,
}) {
  const minCodeLength = useBackupCode ? 8 : 6;

  const handleCodeChange = (rawValue) => {
    if (useBackupCode) {
      onTotpCodeChange(rawValue);
      return;
    }

    onTotpCodeChange(rawValue.replace(/\D/g, ""));
  };

  return (
    <AuthContainer>
      <AuthHeader
        title="Two-Factor Verification"
        description="Enter the code from your authenticator app."
      />

      <AuthCard>
        <form className="space-y-4" onSubmit={onSubmit}>
          <AuthField label={useBackupCode ? "Backup Code" : "6-Digit Code"} htmlFor="totp-code">
            <input
              id="totp-code"
              type="text"
              inputMode={useBackupCode ? "text" : "numeric"}
              pattern={useBackupCode ? undefined : "[0-9]*"}
              maxLength={useBackupCode ? 9 : 6}
              required
              value={totpCode}
              onChange={(event) => handleCodeChange(event.target.value)}
              className={`${AUTH_INPUT_CLASS} font-mono text-center text-lg tracking-widest`}
              placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
              autoFocus
            />
          </AuthField>

          <ApiErrorAlert error={error} />

          <button type="submit" disabled={loading || totpCode.length < minCodeLength} className={AUTH_PRIMARY_BUTTON_CLASS}>
            {loading ? "Verifying..." : "Verify"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleCodeType}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {useBackupCode ? "Use authenticator code" : "Use backup code"}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Back to login
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthContainer>
  );
}
