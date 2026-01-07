# 🗺️ Future Features

> Daftar fitur yang direncanakan untuk pengembangan mendatang.

---

## 🎯 Vision

Alephdraad bertujuan menjadi **platform diskusi teknis terdepan** di Indonesia dengan fitur AI-powered yang membantu pengguna belajar dan berbagi pengetahuan.

---

## 🚀 Planned Features

### Phase 1: Q1 2026 (Foundation)

#### 1.1 Complete ORM Migration
**Priority**: Critical

```
Current: GORM (legacy) + Ent (partial)
Target: Ent only

Tasks:
[ ] Migrate UserService to Ent
[ ] Migrate AuthService to Ent
[ ] Migrate SessionService to Ent
[ ] Migrate all remaining services
[ ] Remove GORM dependency
[ ] Update documentation
```

#### 1.2 Add Redis Caching
**Priority**: High

```
Implementation:
[ ] Setup Upstash Redis
[ ] Cache user sessions
[ ] Cache thread lists
[ ] Cache category data
[ ] Implement cache invalidation
```

#### 1.3 Improve Test Coverage
**Priority**: High

```
Target Coverage:
- Backend Gin: 70%
- Feature Service: 80%
- Frontend: 50%

Tasks:
[ ] Add unit tests for services
[ ] Add integration tests
[ ] Add E2E tests (Playwright)
[ ] Setup CI/CD test pipeline
```

---

### Phase 2: Q2 2026 (Enhancement)

#### 2.1 Real-time Features
**Priority**: Medium

```
Features:
[ ] Live notifications (WebSocket)
[ ] Real-time reply updates
[ ] Online presence indicator
[ ] Typing indicators in chat

Tech Stack:
- Backend: gorilla/websocket atau Centrifugo
- Frontend: Socket.io client
```

#### 2.2 Advanced Search
**Priority**: Medium

```
Features:
[ ] Full-text search across threads
[ ] Filter by date, category, author
[ ] Search in replies
[ ] Saved searches
[ ] Search suggestions

Tech Stack:
- Meilisearch atau Typesense
- Vector search untuk semantic matching
```

#### 2.3 Notification System
**Priority**: Medium

```
Notification Types:
[ ] Reply to your thread
[ ] Mention in reply
[ ] New follower
[ ] Thread featured
[ ] Badge earned

Channels:
[ ] In-app notifications
[ ] Email digest (daily/weekly)
[ ] Push notifications (PWA)
```

---

### Phase 3: Q3 2026 (Social)

#### 3.1 Follow System
**Priority**: Medium

```
Features:
[ ] Follow users
[ ] Follow threads
[ ] Follow categories
[ ] Personalized feed
```

#### 3.2 Bookmarks & Collections
**Priority**: Low

```
Features:
[ ] Bookmark threads
[ ] Create collections
[ ] Share collections
[ ] Import/export bookmarks
```

#### 3.3 Reputation System
**Priority**: Low

```
Features:
[ ] Karma/reputation points
[ ] Contributor levels
[ ] Expertise areas
[ ] Leaderboards
```

---

### Phase 4: Q4 2026 (Monetization)

#### 4.1 Premium Features
**Priority**: Medium

```
Premium Tier:
[ ] Extended AI chat quota
[ ] Priority support
[ ] Custom badges
[ ] Ad-free experience
[ ] Early access features
```

#### 4.2 Creator Program
**Priority**: Low

```
Features:
[ ] Tipping/donations
[ ] Exclusive content
[ ] Subscriber-only threads
[ ] Revenue sharing
```

---

## 🤖 AI Roadmap

### Current AI Features
- ✅ HuggingFace chat (free tier)
- ✅ External LLM via n8n
- ✅ Thread explain (RAG)

### Planned AI Features

#### Short-term (Q1-Q2 2026)
```
[ ] AI-powered thread summarization
[ ] Code explanation in replies
[ ] Auto-tagging threads
[ ] Duplicate detection
[ ] Smart thread recommendations
```

#### Medium-term (Q3-Q4 2026)
```
[ ] Code assistant integration
[ ] AI-powered moderation
[ ] Auto-translation (ID ↔ EN)
[ ] Personalized learning paths
[ ] AI tutor for beginners
```

#### Long-term (2027+)
```
[ ] Multi-modal AI (images, diagrams)
[ ] Voice-to-text for mobile
[ ] AI agents for complex tasks
[ ] Custom fine-tuned models
```

---

## 📱 Mobile App

### Phase 1: PWA Optimization (Q2 2026)
```
[ ] Offline support
[ ] Push notifications
[ ] Home screen install
[ ] Native-like performance
```

### Phase 2: Native App (Q4 2026+)
```
[ ] React Native atau Flutter
[ ] iOS App Store
[ ] Google Play Store
[ ] Biometric authentication
```

---

## 🌐 Internationalization

### Languages Planned
```
[ ] English (full translation)
[ ] Bahasa Indonesia (current)
[ ] Malay
[ ] Vietnamese
[ ] Thai
```

### Implementation
```
[ ] i18n framework (next-intl)
[ ] Translation management (Crowdin)
[ ] RTL support (future)
[ ] Currency localization
```

---

## 📊 Feature Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Redis Caching | High | Medium | P1 |
| Test Coverage | High | Large | P1 |
| ORM Migration | Medium | Large | P1 |
| Real-time | High | Large | P2 |
| Advanced Search | High | Medium | P2 |
| Notifications | Medium | Medium | P2 |
| Follow System | Medium | Medium | P3 |
| Premium Tier | High | Large | P3 |
| Mobile App | High | Very Large | P4 |

---

## ▶️ Selanjutnya

- [91_VERSION_PLANNING.md](./91_VERSION_PLANNING.md) - Detailed version planning
- [92_CONTRIBUTING.md](./92_CONTRIBUTING.md) - How to contribute
