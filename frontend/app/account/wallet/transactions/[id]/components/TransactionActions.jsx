import Link from "next/link";

export default function TransactionActions({ isSender, isReceiver, status, transfer, onAction }) {
  return (
    <>
      {/* Actions for held transfers */}
      {status === "held" && (
        <div className="p-6 border-t border-border space-y-3">
          {isSender && (
            <>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm text-muted-foreground">
                <p className="mb-2">
                  <strong className="text-foreground">For Sender:</strong>
                </p>
                <p>
                  Received the item/service? You may release funds early.
                  <br />
                  Need help? You can request support from our mediation team.
                </p>
              </div>
              <button
                onClick={() => onAction("release")}
                className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Release Funds Early
              </button>
            </>
          )}
          {isReceiver && (
            <>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm text-muted-foreground">
                <p className="mb-2">
                  <strong className="text-foreground">For Recipient:</strong>
                </p>
                <p>As recipient, funds are automatically credited after the hold period ends.</p>
              </div>
              <button
                onClick={() => onAction("reject")}
                className="w-full rounded-lg border border-destructive/30 py-3 font-semibold text-destructive transition hover:bg-destructive/10"
              >
                Reject Transfer & Return to Sender
              </button>
            </>
          )}
          {/* Only sender can open dispute/mediation */}
          {isSender && (
            <button
              onClick={() => onAction("dispute")}
              className="w-full rounded-lg border border-primary/30 py-3 font-semibold text-primary transition hover:bg-primary/10"
            >
              Request Mediation Support
            </button>
          )}
        </div>
      )}

      {/* Link to dispute if disputed */}
      {status === "disputed" && transfer.disputeId && (
        <div className="p-6 border-t border-border">
          <Link
            href={`/account/wallet/disputes/${transfer.disputeId}`}
            className="block w-full rounded-lg bg-primary/10 border border-primary/30 py-3 text-center font-semibold text-primary transition hover:opacity-80"
          >
            View Mediation Details
          </Link>
        </div>
      )}
    </>
  );
}
