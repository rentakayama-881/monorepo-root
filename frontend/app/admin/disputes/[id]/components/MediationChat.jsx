import { formatDate } from "./disputeHelpers";

export default function MediationChat({
  dispute,
  isClosed,
  message,
  sending,
  messagesContainerRef,
  onMessagesScroll,
  onMessageChange,
  onSendMessage,
}) {
  const buyerUsername = dispute.senderUsername || dispute.initiatorUsername;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Diskusi Mediasi</h3>
        <p className="text-xs text-muted-foreground">Chat antara pembeli, penjual, dan admin</p>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={onMessagesScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50"
        style={{ minHeight: "400px", maxHeight: "500px" }}
      >
        {dispute.messages?.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>Belum ada pesan dalam sengketa ini.</p>
          </div>
        )}

        {dispute.messages?.map((msg) => {
          const isAdmin = msg.isAdmin;
          const isBuyer = msg.senderUsername === buyerUsername;

          return (
            <div
              key={msg.id}
              className={`flex ${isAdmin ? "justify-center" : isBuyer ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] ${
                  isAdmin
                    ? "bg-warning/10 border border-warning/20 w-full"
                    : isBuyer
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-success/10 border border-success/20"
                } rounded-lg px-4 py-2`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isAdmin ? "text-warning" : isBuyer ? "text-primary" : "text-success"
                  }`}
                >
                  {isAdmin && "👑 "}@{msg.senderUsername}
                  {isAdmin ? " (Admin)" : isBuyer ? " (Pembeli)" : " (Penjual)"}
                </div>
                <p className="text-sm text-foreground">{msg.content}</p>
                <div className="text-xs text-muted-foreground mt-1">{formatDate(msg.sentAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin Message Input */}
      {!isClosed && (
        <form onSubmit={onSendMessage} className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Kirim pesan sebagai admin..."
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:border-primary"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="px-6 py-2 rounded-lg border border-warning/25 bg-warning/15 text-warning font-medium transition hover:bg-warning/20 disabled:opacity-50"
            >
              {sending ? "..." : "👑 Kirim"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
