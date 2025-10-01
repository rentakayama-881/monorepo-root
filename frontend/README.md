Ballerina Frontend (Next.js) — Migration from Legacy HTML

Overview
- This Next.js frontend replaces the prior HTML templates in c:\\Users\\PC-04\\ballerina\\templates.
- Architecture: Next.js (App Router) → Gin backend (http://localhost:8080) → PostgreSQL (managed by Rails migrations).

Environment
- Create a .env.local in this directory:
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

Run
- npm install
- npm run dev
- The app will be available at http://localhost:3000

Routes (App Router)
- /                → Home (replaces templates/index.html)
- /login           → Login page. Starts GitHub OAuth via backend endpoint (/api/auth/github).
- /set-username    → Username creation form (POST to /api/auth/username with Authorization).
- /sync-token      → Reads token from URL (?token=...) and persists to localStorage, then redirects.
- /refill-balance  → Refill flow, consumes /api/balance/refill/info and /api/balance/refill/address.
- /rules-content   → Static rules content (from templates/components/rules_section.html).
- /about-content   → Placeholder static content for sidebar (replaces legacy dynamic fragment).

Components
- components/Header.jsx         → Header with hamburger/menu and login/profile avatar controls.
- components/Sidebar.jsx        → Sidebar (main menu + Threads submenu), dynamic content loaders.
- components/ProfileSidebar.jsx → User quick panel; fetches /api/user/me if token present.

Auth flow (development)
- From /login, browser navigates to backend: ${NEXT_PUBLIC_API_BASE_URL}/api/auth/github
- Backend completes GitHub OAuth and should redirect to:
  http://localhost:3000/sync-token?token=<JWT>
- /sync-token saves token to localStorage and redirects to /
- Authenticated API calls include Authorization: Bearer <token>

Styling & Accessibility
- TailwindCSS 4 is configured. Accessibility and semantic HTML are emphasized. Replace any remaining inline style or DOM manipulation over time with React state.

CORS & Backend
- Backend CORS should allow http://localhost:3000 and the Authorization header.
- Prefer cookie-based auth in production for security; local demo uses localStorage for parity with legacy.

Testing (recommendation)
- Unit: React Testing Library for components
- Integration: Mock fetch for API client interactions
- E2E: Playwright against Gin backend in dev

Notes
- Legacy dynamic sidebar fragments were replaced with /about-content and /rules-content routes.
- Move any additional legacy assets to /public as needed (e.g., /public/images/logo.png). Ensure logo exists.
- For production, consider changing the token sync method to an HttpOnly cookie in backend to avoid localStorage.
