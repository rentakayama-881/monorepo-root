import { formatDate } from "./utils";

export default function DisputeMessages({
  messages,
  currentUser,
  isOpen,
  messagesContainerRef,
  onScroll,
  message,
  onMessageChange,
  onSendMessage,
  sendingMessage,
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold text-foreground">Discussion</h3>
      </div>
      <div
        ref={messagesContainerRef}
        onScroll={onScroll}
        className="h-80 overflow-y-auto p-4 space-y-4"
      >
        {messages?.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No messages yet</div>
        ) : (
          messages?.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.senderId === currentUser?.id || msg.senderUsername === currentUser?.username
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs rounded-lg p-3 ${
                  msg.isAdmin
                    ? "bg-accent text-accent-foreground border border-border"
                    : msg.senderId === currentUser?.id ||
                        msg.senderUsername === currentUser?.username
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border"
                }`}
              >
                <div className="text-xs font-medium mb-1">
                  {msg.isAdmin ? "Admin" : msg.senderUsername || "User"}
                </div>
                <div className="text-sm">{msg.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    msg.senderId === currentUser?.id || msg.senderUsername === currentUser?.username
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatDate(msg.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      {isOpen && (
        <form onSubmit={onSendMessage} className="border-t border-border p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Write a message..."
              aria-label="Tulis pesan"
              className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={sendingMessage || !message.trim()}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
