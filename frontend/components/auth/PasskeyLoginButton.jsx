import { AUTH_SECONDARY_BUTTON_CLASS } from "@/components/auth/AuthPrimitives";

export default function PasskeyLoginButton({ loading, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={AUTH_SECONDARY_BUTTON_CLASS}
    >
      {loading ? (
        <>
          <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          Verifying...
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          Continue with passkey
        </>
      )}
    </button>
  );
}
