import { AUTH_SECONDARY_BUTTON_CLASS } from "@/components/auth/AuthPrimitives";
import { KeyRound } from "lucide-react";

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
          Memverifikasi...
        </>
      ) : (
        <>
          <KeyRound className="w-4 h-4 mr-2" />
          Lanjutkan dengan passkey
        </>
      )}
    </button>
  );
}
