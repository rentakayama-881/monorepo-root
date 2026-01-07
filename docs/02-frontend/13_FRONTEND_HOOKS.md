# 🪝 Frontend Hooks

> Dokumen ini menjelaskan custom hooks yang tersedia di folder `lib/`.

---

## 📁 Daftar Hooks

| File | Hooks | Deskripsi |
|------|-------|-----------|
| `useAIChat.js` | Multiple | AI Chat functionality |
| `useReplies.js` | `useReplies`, `useDeleteReply` | Reply CRUD |
| `useReactions.js` | `useReactions` | Reaction management |
| `useDocuments.js` | `useDocuments` | Document management |
| `useReport.js` | `useReport` | Report content |
| `hooks.js` | Misc | General utility hooks |

---

## 🤖 AI Chat Hooks (`useAIChat.js`)

### useTokenBalance

Mengambil saldo token AI user.

```jsx
import { useTokenBalance } from "@/lib/useAIChat";

function WalletWidget() {
  const { balance, loading, error, refetch } = useTokenBalance();

  if (loading) return <Spinner />;
  
  return (
    <div>
      <p>Saldo: {balance.tokens} tokens</p>
      <p>Free remaining: {balance.freeTokensRemaining}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

**Returns**:
| Property | Type | Description |
|----------|------|-------------|
| `balance` | object | `{ tokens, freeTokensRemaining }` |
| `loading` | boolean | Loading state |
| `error` | string | Error message |
| `refetch` | function | Refresh balance |

---

### useTokenPackages

Mengambil daftar paket token yang tersedia.

```jsx
import { useTokenPackages } from "@/lib/useAIChat";

function TokenShop() {
  const { packages, loading, error } = useTokenPackages();

  return (
    <div className="grid grid-cols-3 gap-4">
      {packages.map(pkg => (
        <div key={pkg.id}>
          <h3>{pkg.name}</h3>
          <p>{pkg.tokenAmount} tokens</p>
          <p>Rp {pkg.priceIdr.toLocaleString()}</p>
          <p>Bonus: {pkg.bonusTokens}</p>
        </div>
      ))}
    </div>
  );
}
```

**Package Object**:
```javascript
{
  id: "pkg_starter",
  name: "Starter",
  tokenAmount: 10000,
  priceIdr: 50000,
  bonusTokens: 500,
  description: "Paket pemula"
}
```

---

### usePurchaseTokens

Membeli paket token.

```jsx
import { usePurchaseTokens } from "@/lib/useAIChat";

function BuyButton({ packageId }) {
  const { purchaseTokens, loading, error, success } = usePurchaseTokens();

  const handleBuy = async () => {
    try {
      const result = await purchaseTokens(packageId);
      console.log("New balance:", result.newBalance);
    } catch (err) {
      console.error("Purchase failed:", err.message);
    }
  };

  return (
    <button onClick={handleBuy} disabled={loading}>
      {loading ? "Processing..." : "Beli"}
    </button>
  );
}
```

---

### useChatSessions

Mengambil daftar chat sessions user.

```jsx
import { useChatSessions } from "@/lib/useAIChat";

function ChatHistory() {
  const { 
    sessions, 
    loading, 
    hasMore, 
    loadMore,
    createSession 
  } = useChatSessions();

  const handleNewChat = async () => {
    const sessionId = await createSession({
      serviceType: "huggingface", // atau "external_llm"
      model: null, // untuk huggingface
      title: "New Chat"
    });
    router.push(`/chat/${sessionId}`);
  };

  return (
    <div>
      <button onClick={handleNewChat}>New Chat</button>
      {sessions.map(session => (
        <div key={session.id}>
          <h4>{session.title}</h4>
          <p>{session.messageCount} messages</p>
          <p>Model: {session.model || "Llama 3.3"}</p>
        </div>
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
}
```

---

### useChatSession

Hook untuk single chat session dengan send message.

```jsx
import { useChatSession } from "@/lib/useAIChat";

function ChatRoom({ sessionId }) {
  const { 
    session, 
    messages, 
    loading, 
    sending,
    sendMessage,
    error 
  } = useChatSession(sessionId);

  const [input, setInput] = useState("");

  const handleSend = async () => {
    if (!input.trim()) return;
    
    try {
      const response = await sendMessage(input);
      setInput("");
      console.log("Tokens used:", response.tokensUsed);
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <div className="input">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
```

---

### Available AI Models

```javascript
import { 
  AI_SERVICE_TYPES, 
  EXTERNAL_LLM_MODELS, 
  HUGGINGFACE_MODEL 
} from "@/lib/useAIChat";

// Service types
AI_SERVICE_TYPES.HUGGINGFACE  // "huggingface" - Free tier
AI_SERVICE_TYPES.EXTERNAL_LLM // "external_llm" - Paid

// HuggingFace model (free)
HUGGINGFACE_MODEL = {
  id: "meta-llama/Llama-3.3-70B-Instruct",
  name: "Llama 3.3 70B",
  provider: "HuggingFace",
  description: "Free tier - Powerful open source model"
}

// External LLM models (paid)
EXTERNAL_LLM_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "Google" },
  // ... more models
]
```

---

## 💬 Reply Hooks (`useReplies.js`)

### useReplies

Mengambil daftar replies untuk thread.

```jsx
import { useReplies } from "@/lib/useReplies";

function ReplySection({ threadId }) {
  const { 
    replies, 
    loading, 
    error, 
    hasMore,
    loadMore,
    refetch,
    createReply 
  } = useReplies(threadId);

  const handleReply = async (content, parentReplyId = null) => {
    try {
      await createReply({ content, parentReplyId });
      refetch();
    } catch (err) {
      toast.error("Gagal", err.message);
    }
  };

  return (
    <div>
      {replies.map(reply => (
        <ReplyItem 
          key={reply.id} 
          reply={reply}
          onReply={(content) => handleReply(content, reply.id)}
        />
      ))}
    </div>
  );
}
```

**Reply Object**:
```javascript
{
  id: "rpl_01HN5...",
  content: "Terima kasih!",
  username: "johndoe",
  userId: 123,
  parentReplyId: null,
  depth: 0,
  isDeleted: false,
  createdAt: "2026-01-07T10:00:00Z",
  updatedAt: "2026-01-07T10:00:00Z"
}
```

---

### useDeleteReply

Menghapus reply.

```jsx
import { useDeleteReply } from "@/lib/useReplies";

function ReplyItem({ reply, threadId, onDeleted }) {
  const { deleteReply, loading } = useDeleteReply();

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus?")) return;
    
    try {
      await deleteReply(threadId, reply.id);
      onDeleted();
    } catch (err) {
      toast.error("Gagal", err.message);
    }
  };

  return (
    <div>
      <p>{reply.content}</p>
      {isAuthor && (
        <button onClick={handleDelete} disabled={loading}>
          Delete
        </button>
      )}
    </div>
  );
}
```

---

## 👍 Reaction Hooks (`useReactions.js`)

### useReactions

Mengelola reactions untuk thread.

```jsx
import { useReactions } from "@/lib/useReactions";

function ReactionBar({ threadId }) {
  const { 
    reactions,      // { like: 12, love: 5, ... }
    userReaction,   // "like" atau null
    loading,
    addReaction,
    removeReaction 
  } = useReactions(threadId);

  const handleReact = async (type) => {
    try {
      if (userReaction === type) {
        await removeReaction();
      } else {
        await addReaction(type);
      }
    } catch (err) {
      toast.error("Gagal", err.message);
    }
  };

  return (
    <div className="flex gap-2">
      {["like", "love", "fire", "sad", "laugh"].map(type => (
        <button 
          key={type}
          onClick={() => handleReact(type)}
          className={userReaction === type ? "active" : ""}
        >
          {getEmoji(type)} {reactions[type] || 0}
        </button>
      ))}
    </div>
  );
}
```

---

## 📄 Document Hooks (`useDocuments.js`)

### useDocuments

Mengelola dokumen user.

```jsx
import { useDocuments } from "@/lib/useDocuments";

function DocumentList() {
  const { 
    documents, 
    loading,
    uploadDocument,
    deleteDocument,
    refetch 
  } = useDocuments();

  const handleUpload = async (file) => {
    try {
      await uploadDocument(file, {
        title: file.name,
        category: "general",
        isPublic: false
      });
      refetch();
    } catch (err) {
      toast.error("Upload gagal", err.message);
    }
  };

  return (
    <div>
      <input type="file" onChange={e => handleUpload(e.target.files[0])} />
      {documents.map(doc => (
        <div key={doc.id}>
          <span>{doc.title}</span>
          <button onClick={() => deleteDocument(doc.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🚨 Report Hook (`useReport.js`)

### useReport

Melaporkan konten.

```jsx
import { useReport } from "@/lib/useReport";

function ReportButton({ targetType, targetId }) {
  const { submitReport, loading, reasons } = useReport();
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const handleSubmit = async () => {
    try {
      await submitReport({
        targetType, // "thread" atau "reply"
        targetId,
        reason,     // reason code
        details     // additional details
      });
      setShowModal(false);
      toast.success("Terkirim", "Laporan Anda akan ditinjau");
    } catch (err) {
      toast.error("Gagal", err.message);
    }
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>🚨 Laporkan</button>
      
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <h3>Laporkan Konten</h3>
        <select value={reason} onChange={e => setReason(e.target.value)}>
          {reasons.map(r => (
            <option key={r.code} value={r.code}>{r.label}</option>
          ))}
        </select>
        <textarea 
          value={details} 
          onChange={e => setDetails(e.target.value)}
          placeholder="Detail tambahan..."
        />
        <button onClick={handleSubmit} disabled={loading}>
          Kirim Laporan
        </button>
      </Modal>
    </>
  );
}
```

---

## 🔧 General Hooks (`hooks.js`)

### useDebounce

Delay nilai untuk mengurangi API calls.

```jsx
import { useDebounce } from "@/lib/hooks";

function SearchBox() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300); // 300ms delay

  useEffect(() => {
    if (debouncedQuery) {
      searchAPI(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### useLocalStorage

Persist state ke localStorage.

```jsx
import { useLocalStorage } from "@/lib/hooks";

function ThemeSwitcher() {
  const [theme, setTheme] = useLocalStorage("theme", "light");

  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
```

---

## 🎯 Hook Patterns

### Pattern: Data Fetching Hook

```javascript
function useData(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJsonAuth(url);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### Pattern: Mutation Hook

```javascript
function useMutation(mutationFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutationFn(...args);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  return { mutate, loading, error };
}
```

---

## ▶️ Selanjutnya

- [14_FRONTEND_API_CLIENTS.md](./14_FRONTEND_API_CLIENTS.md) - API integration
- [../03-backend-gin/20_BACKEND_GIN_OVERVIEW.md](../03-backend-gin/20_BACKEND_GIN_OVERVIEW.md) - Backend Gin
