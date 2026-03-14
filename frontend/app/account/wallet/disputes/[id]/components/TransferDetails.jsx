export default function TransferDetails({ dispute, isSender, isReceiver }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground mb-4">Transfer Details</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium text-foreground">
            Rp {dispute.amount?.toLocaleString("id-ID") || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Buyer (Fund Sender)</span>
          <span className="font-medium text-foreground">
            @{dispute.senderUsername}
            {isSender && " (You)"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Seller (Fund Recipient)</span>
          <span className="font-medium text-foreground">
            @{dispute.receiverUsername}
            {isReceiver && " (You)"}
          </span>
        </div>
      </div>
    </div>
  );
}
