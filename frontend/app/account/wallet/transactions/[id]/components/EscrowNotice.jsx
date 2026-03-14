import { Clock } from "lucide-react";

export default function EscrowNotice({ isSender, holdInfo }) {
  return (
    <div className="mx-6 mb-6 rounded-lg bg-warning/10 border border-warning/30 p-4">
      <div className="flex gap-3">
        <Clock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-warning mb-1">Funds Under Escrow Protection</div>
          <div className="text-sm text-muted-foreground">
            {isSender ? (
              <>
                Your funds are temporarily held to protect the transaction.
                {holdInfo.daysRemaining > 0
                  ? ` Funds will be automatically released to the recipient in ${holdInfo.daysRemaining} days.`
                  : " Funds will be released to the recipient shortly."}
                <br />
                <br />
                <strong>Received the item/service?</strong> You can release funds early.
                <br />
                <strong>Need help?</strong> You can cancel the transaction or request support from
                our team.
              </>
            ) : (
              <>
                Funds are currently held in escrow to protect both parties.
                {holdInfo.daysRemaining > 0
                  ? ` Funds will be added to your balance automatically in ${holdInfo.daysRemaining} days.`
                  : " Funds will be added to your balance shortly."}
                <br />
                <br />
                <strong>Encountering an issue?</strong> You can request support from our mediation
                team.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
