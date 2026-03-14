import StatusBadge from "./StatusBadge";
import { formatDate } from "./useTransactionDetail";

export default function TransactionHeader({ transfer, isSender, status, holdInfo }) {
  return (
    <>
      {/* Header */}
      <div className="border-b border-border p-6 text-center">
        <div className="text-sm text-muted-foreground mb-1">
          {isSender ? "You sent to" : "You received from"}
          <span className="font-medium text-foreground ml-1">
            @{isSender ? transfer.receiverUsername : transfer.senderUsername}
          </span>
        </div>
        <div className="text-3xl font-bold text-foreground mb-3">
          Rp {transfer.amount?.toLocaleString("id-ID") || 0}
        </div>
        <StatusBadge status={transfer.status} />
      </div>

      {/* Details */}
      <div className="p-6 space-y-4">
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Sender</span>
          <span className="font-medium text-foreground">
            @{transfer.senderUsername || "Unknown"}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Recipient</span>
          <span className="font-medium text-foreground">
            @{transfer.receiverUsername || "Unknown"}
          </span>
        </div>
        {transfer.message && (
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Note</span>
            <span className="font-medium text-foreground text-right max-w-xs">
              {transfer.message}
            </span>
          </div>
        )}
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Transfer Code</span>
          <span className="font-mono text-foreground">{transfer.code}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Created Date</span>
          <span className="font-medium text-foreground">{formatDate(transfer.createdAt)}</span>
        </div>
        {status === "held" && holdInfo && (
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Auto Release</span>
            <span className="font-medium text-foreground">{formatDate(transfer.holdUntil)}</span>
          </div>
        )}
        {transfer.releasedAt && (
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Completed Date</span>
            <span className="font-medium text-primary">{formatDate(transfer.releasedAt)}</span>
          </div>
        )}
        {transfer.cancelledAt && (
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Cancelled Date</span>
            <span className="font-medium text-destructive">{formatDate(transfer.cancelledAt)}</span>
          </div>
        )}
      </div>
    </>
  );
}
