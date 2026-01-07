# 📊 Alur Data (Data Flow)

> Dokumen ini menjelaskan bagaimana data mengalir dari UI pengguna hingga tersimpan di database.

---

## 🎯 Prinsip Dasar

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                │
│                                                                 │
│   USER ACTION → FRONTEND → BACKEND → DATABASE → RESPONSE       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Setiap aksi pengguna mengikuti pola:
1. **Input** - User melakukan aksi (klik, ketik, dll)
2. **Request** - Frontend mengirim data ke backend
3. **Processing** - Backend memproses (validasi, logika bisnis)
4. **Storage** - Data disimpan ke database
5. **Response** - Backend mengirim hasil ke frontend
6. **Display** - Frontend menampilkan ke user

---

## 📝 Contoh: Membuat Thread Baru

### Langkah Detail

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: USER INPUT                                              │
│ ─────────────────                                               │
│ User mengisi form di halaman /threads/new:                      │
│ • Title: "Cara Deploy Next.js ke Vercel"                        │
│ • Category: "web-development"                                   │
│ • Content: [...data tabel/konten...]                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: FRONTEND PROCESSING                                     │
│ ─────────────────────────                                       │
│ File: app/threads/new/page.jsx                                  │
│                                                                 │
│ const handleSubmit = async (formData) => {                      │
│   const response = await fetchJsonAuth("/api/threads", {        │
│     method: "POST",                                             │
│     body: JSON.stringify({                                      │
│       title: formData.title,                                    │
│       categoryId: formData.categoryId,                          │
│       contentJson: formData.content,                            │
│       summary: formData.summary                                 │
│     })                                                          │
│   });                                                           │
│ };                                                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ HTTP POST /api/threads
                          │ Headers: Authorization: Bearer eyJ...
                          │ Body: { title, categoryId, contentJson }
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: BACKEND MIDDLEWARE                                      │
│ ─────────────────────────                                       │
│ File: middleware/auth.go                                        │
│                                                                 │
│ a. Extract JWT dari header Authorization                        │
│ b. Validate JWT signature                                       │
│ c. Parse claims (userId, username, email)                       │
│ d. Set user context untuk handler berikutnya                    │
│                                                                 │
│ Jika JWT invalid → 401 Unauthorized                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: HANDLER                                                 │
│ ───────────────                                                 │
│ File: handlers/thread_handler.go                                │
│                                                                 │
│ func (h *ThreadHandler) CreateThread(c *gin.Context) {          │
│   // 1. Parse request body                                      │
│   var req dto.CreateThreadRequest                               │
│   c.ShouldBindJSON(&req)                                        │
│                                                                 │
│   // 2. Get user from context                                   │
│   userId := c.GetUint("userId")                                 │
│                                                                 │
│   // 3. Call service layer                                      │
│   thread, err := h.service.CreateThread(userId, req)            │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: SERVICE LAYER                                           │
│ ────────────────────                                            │
│ File: services/thread_service.go                                │
│                                                                 │
│ func (s *ThreadService) CreateThread(...) {                     │
│   // 1. Validate category exists                                │
│   category := s.db.First(&category, req.CategoryID)             │
│                                                                 │
│   // 2. Create thread object                                    │
│   thread := models.Thread{                                      │
│     UserID:      userId,                                        │
│     CategoryID:  req.CategoryID,                                │
│     Title:       req.Title,                                     │
│     ContentJSON: req.ContentJSON,                               │
│   }                                                             │
│                                                                 │
│   // 3. Save to database                                        │
│   s.db.Create(&thread)                                          │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: DATABASE (PostgreSQL)                                   │
│ ──────────────────────────────                                  │
│                                                                 │
│ INSERT INTO threads (                                           │
│   user_id, category_id, title, content_json, created_at         │
│ ) VALUES (                                                      │
│   123, 5, 'Cara Deploy Next.js ke Vercel', '{...}', NOW()       │
│ ) RETURNING id;                                                 │
│                                                                 │
│ → Returns: id = 456                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: RESPONSE                                                │
│ ───────────────                                                 │
│                                                                 │
│ {                                                               │
│   "success": true,                                              │
│   "data": {                                                     │
│     "id": 456,                                                  │
│     "title": "Cara Deploy Next.js ke Vercel",                   │
│     "categorySlug": "web-development",                          │
│     "createdAt": "2026-01-07T10:00:00Z"                         │
│   }                                                             │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: FRONTEND UPDATE                                         │
│ ───────────────────────                                         │
│                                                                 │
│ // Redirect ke halaman thread yang baru dibuat                  │
│ router.push(`/thread/${response.data.id}`);                     │
│                                                                 │
│ // Atau update state lokal                                      │
│ setThreads(prev => [response.data, ...prev]);                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💬 Contoh: Mengirim Reply

### Data Flow ke Feature Service (MongoDB)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER: Ketik reply "Terima kasih, sangat membantu!" → Submit     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: lib/useReplies.js                                     │
│                                                                 │
│ const { createReply } = useReplies();                           │
│ await createReply(threadId, {                                   │
│   content: "Terima kasih, sangat membantu!",                    │
│   parentReplyId: null  // top-level reply                       │
│ });                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ POST feature.alephdraad.fun/api/v1/threads/456/replies
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ FEATURE SERVICE (ASP.NET Core)                                  │
│ ────────────────────────────────                                │
│                                                                 │
│ Controller: Social/ReplyController.cs                           │
│ [HttpPost]                                                      │
│ public async Task<IActionResult> CreateReply(                   │
│   string threadId,                                              │
│   [FromBody] CreateReplyRequest request)                        │
│ {                                                               │
│   var userId = _userContext.UserId;                             │
│   var reply = await _replyService.CreateReplyAsync(             │
│     threadId, userId, request.Content, request.ParentReplyId);  │
│   return Ok(new { success = true, data = reply });              │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE: Services/ReplyService.cs                               │
│                                                                 │
│ public async Task<Reply> CreateReplyAsync(...)                  │
│ {                                                               │
│   // 1. Validate parent exists (if nested)                      │
│   // 2. Check depth limit (max 3)                               │
│   // 3. Create reply document                                   │
│   var reply = new Reply                                         │
│   {                                                             │
│     Id = $"rpl_{Ulid.NewUlid()}",                               │
│     ThreadId = threadId,                                        │
│     UserId = userId,                                            │
│     Content = content,                                          │
│     ParentReplyId = parentReplyId,                              │
│     Depth = parentDepth + 1,                                    │
│     CreatedAt = DateTime.UtcNow                                 │
│   };                                                            │
│                                                                 │
│   // 4. Insert to MongoDB                                       │
│   await _context.Replies.InsertOneAsync(reply);                 │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ MONGODB DOCUMENT                                                │
│                                                                 │
│ db.replies.insertOne({                                          │
│   _id: "rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T",                        │
│   threadId: "456",                                              │
│   userId: 123,                                                  │
│   username: "johndoe",                                          │
│   content: "Terima kasih, sangat membantu!",                    │
│   parentReplyId: null,                                          │
│   depth: 0,                                                     │
│   isDeleted: false,                                             │
│   createdAt: ISODate("2026-01-07T10:00:00Z"),                   │
│   updatedAt: ISODate("2026-01-07T10:00:00Z")                    │
│ })                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Contoh: Chat dengan AI (Aleph)

### Data Flow dengan Token Deduction

```
┌─────────────────────────────────────────────────────────────────┐
│ USER: "Jelaskan cara kerja JWT dalam 3 paragraf"                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: lib/useAIChat.js                                      │
│                                                                 │
│ const { sendMessage } = useChatSession(sessionId);              │
│ const response = await sendMessage("Jelaskan cara kerja...");   │
│                                                                 │
│ // POST /api/v1/chat/sessions/{sessionId}/messages              │
│ // Body: { content: "Jelaskan cara kerja JWT..." }              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ FEATURE SERVICE: Controllers/ChatController.cs                  │
│                                                                 │
│ [HttpPost("{sessionId}/messages")]                              │
│ public async Task<IActionResult> SendMessage(...)               │
│ {                                                               │
│   var result = await _chatService.SendMessageAsync(             │
│     sessionId, userId, content);                                │
│   return Ok(result);                                            │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ CHAT SERVICE: Services/ChatService.cs                           │
│                                                                 │
│ 1. GET SESSION                                                  │
│    var session = await _context.ChatSessions                    │
│      .Find(s => s.Id == sessionId).FirstOrDefault();            │
│                                                                 │
│ 2. CHECK TOKEN BALANCE                                          │
│    var hasTokens = await _tokenService                          │
│      .HasSufficientTokensAsync(userId, estimatedTokens);        │
│    if (!hasTokens) throw new InsufficientTokensException();     │
│                                                                 │
│ 3. LOAD CONVERSATION HISTORY                                    │
│    var history = await _context.ChatMessages                    │
│      .Find(m => m.SessionId == sessionId)                       │
│      .SortBy(m => m.CreatedAt)                                  │
│      .ToListAsync();                                            │
│                                                                 │
│ 4. CALL AI PROVIDER                                             │
│    var aiResult = session.ServiceType == "huggingface"          │
│      ? await _huggingFaceService.ChatAsync(content, history)    │
│      : await _externalLlmService.ChatAsync(model, content, ...)│
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXTERNAL AI PROVIDER                                            │
│                                                                 │
│ HuggingFace:                                                    │
│   POST https://api-inference.huggingface.co/models/...          │
│                                                                 │
│ External LLM (via n8n):                                         │
│   POST https://your-n8n-webhook.com/webhook/llm                 │
│   { model: "gpt-4o", messages: [...] }                          │
│                                                                 │
│ Response:                                                       │
│ {                                                               │
│   "content": "JWT (JSON Web Token) adalah...",                  │
│   "inputTokens": 45,                                            │
│   "outputTokens": 180                                           │
│ }                                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST-PROCESSING (ChatService)                                   │
│                                                                 │
│ 5. SAVE MESSAGES TO MONGODB                                     │
│    // User message                                              │
│    await _context.ChatMessages.InsertOneAsync(new ChatMessage { │
│      Id = $"msg_{Ulid.NewUlid()}",                              │
│      SessionId = sessionId,                                     │
│      Role = "user",                                             │
│      Content = userMessage,                                     │
│      TokensUsed = inputTokens                                   │
│    });                                                          │
│                                                                 │
│    // Assistant message                                         │
│    await _context.ChatMessages.InsertOneAsync(new ChatMessage { │
│      Role = "assistant",                                        │
│      Content = aiResult.Content,                                │
│      TokensUsed = outputTokens                                  │
│    });                                                          │
│                                                                 │
│ 6. DEDUCT TOKENS                                                │
│    totalTokens = inputTokens + outputTokens; // 45 + 180 = 225  │
│    await _tokenService.DeductTokensAsync(userId, totalTokens,   │
│      session.ServiceType, session.Model, sessionId);            │
│                                                                 │
│ 7. UPDATE SESSION STATS                                         │
│    session.TotalTokensUsed += totalTokens;                      │
│    session.MessageCount += 2;                                   │
│    session.UpdatedAt = DateTime.UtcNow;                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ RESPONSE TO FRONTEND                                            │
│                                                                 │
│ {                                                               │
│   "success": true,                                              │
│   "data": {                                                     │
│     "messageId": "msg_01HN5...",                                │
│     "content": "JWT (JSON Web Token) adalah standar...",        │
│     "tokensUsed": 225,                                          │
│     "remainingBalance": 9775                                    │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Data Storage Summary

### PostgreSQL (Backend Gin)
| Tabel | Data |
|-------|------|
| `users` | User accounts, credentials |
| `threads` | Thread posts |
| `categories` | Thread categories |
| `sessions` | Login sessions |
| `passkeys` | WebAuthn credentials |
| `backup_codes` | 2FA backup codes |
| `security_events` | Audit log |

### MongoDB (Feature Service)
| Collection | Data |
|------------|------|
| `replies` | Thread replies |
| `reactions` | Like, love, fire, sad, laugh |
| `chatSessions` | AI chat sessions |
| `chatMessages` | Chat message history |
| `tokenBalances` | User token balances |
| `tokenUsage` | Token usage history |
| `wallets` | User wallets |
| `reports` | User reports |

---

## 🔄 Data Synchronization

### User Data Shared Between Services

Meskipun ada 2 backend, **user data tidak diduplikasi**:

```
┌─────────────────────────────────────────────────────────────────┐
│ JWT TOKEN CONTAINS:                                             │
│                                                                 │
│ {                                                               │
│   "userId": 123,        ← ID unik user                          │
│   "username": "john",   ← Untuk display                         │
│   "email": "j@mail.com" ← Untuk reference                       │
│ }                                                               │
│                                                                 │
│ Feature Service TIDAK query ke PostgreSQL.                      │
│ Semua info user diambil dari JWT claims.                        │
└─────────────────────────────────────────────────────────────────┘
```

### Contoh di Feature Service:
```csharp
// UserContextAccessor.cs
public class UserContextAccessor : IUserContextAccessor
{
    public uint UserId => GetClaimValue<uint>("userId");
    public string Username => GetClaimValue<string>("username");
    public string Email => GetClaimValue<string>("email");
}
```

---

## ▶️ Selanjutnya

- [../02-frontend/10_FRONTEND_OVERVIEW.md](../02-frontend/10_FRONTEND_OVERVIEW.md) - Detail frontend
- [../03-backend-gin/20_BACKEND_GIN_OVERVIEW.md](../03-backend-gin/20_BACKEND_GIN_OVERVIEW.md) - Detail backend Gin
