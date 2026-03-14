import Link from "next/link";
import { Lock } from "lucide-react";

export default function NoPinModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card p-6">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-warning/10 p-3">
            <Lock className="h-8 w-8 text-warning" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2 text-center">PIN Not Configured</h3>
        <div className="text-sm text-muted-foreground mb-6 text-center space-y-2">
          <p>To perform this action, you must set up a security PIN first.</p>
          <p className="text-xs">Please set up a PIN by following:</p>
          <ol className="text-xs text-left list-decimal list-inside space-y-1">
            <li>Enable two-factor authentication (2FA) in account settings</li>
            <li>
              Then click <strong>Send Funds</strong> or <strong>Withdraw Funds</strong> to configure
              your PIN
            </li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
          >
            Close
          </button>
          <Link
            href="/account?setup2fa=true"
            className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground text-center transition hover:opacity-90"
          >
            Security Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
