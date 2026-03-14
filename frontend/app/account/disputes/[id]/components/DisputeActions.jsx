function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({ msg, currentUserId }) {
  const isMe = Number(msg.senderId) === Number(currentUserId);
  const isAdmin = msg.isAdmin;

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] ${
          isAdmin
            ? "bg-warning/10 border border-warning/20"
            : isMe
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border"
        } rounded-lg px-4 py-2`}
      >
        <div
          className={`text-xs font-medium mb-1 ${
            isAdmin ? "text-warning" : isMe ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {isAdmin && "👑 "}@{msg.senderUsername}
          {isAdmin && " (Admin)"}
        </div>
        <p
          className={`text-sm ${isMe && !isAdmin ? "text-primary-foreground" : "text-foreground"}`}
        >
          {msg.content}
        </p>
        <div
          className={`text-xs mt-1 ${
            isMe && !isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          {formatDate(msg.sentAt)}
        </div>
      </div>
    </div>
  );
}

export default function DisputeActions({
  dispute,
  currentUserId,
  isClosed,
  message,
  setMessage,
  sending,
  error,
  messagesContainerRef,
  handleMessagesScroll,
  handleSendMessage,
}) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Mediation Discussion</h3>
        <p className="text-xs text-muted-foreground">
          Discuss the issue with the counterparty and the admin team
        </p>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="h-96 overflow-y-auto p-4 space-y-4 bg-background/50"
      >
        {dispute?.messages?.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet. Start the discussion to resolve this issue.</p>
          </div>
        )}

        {dispute?.messages?.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} currentUserId={currentUserId} />
        ))}
      </div>

      {/* Message Input */}
      {!isClosed ? (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:border-primary"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium transition hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-border bg-muted/30 text-center text-sm text-muted-foreground">
          This dispute has been closed. Messaging is no longer available.
        </div>
      )}
    </div>
  );
}
