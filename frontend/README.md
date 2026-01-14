# Alephdraad Frontend

Next.js 15 application with React 19 and Tailwind CSS 4.

**Last Updated:** January 12, 2026

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **React:** 19.x
- **Styling:** Tailwind CSS 4.x
- **Data Fetching:** SWR
- **Deployment:** Vercel

---

## Quick Start

### Prerequisites
- Node.js 24.12+ (24.x)
- npm 10+

### Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
frontend/
├── app/                      # App Router pages
│   ├── layout.js             # Root layout
│   ├── page.js               # Home page
│   ├── globals.css           # Global styles
│   │
│   ├── login/                # Auth pages
│   ├── register/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── verify-email/
│   ├── set-username/
│   │
│   ├── account/              # User account pages
│   │   ├── settings/
│   │   ├── security/
│   │   └── wallet/
│   │
│   ├── thread/               # Thread pages
│   │   └── [id]/
│   ├── threads/              # Thread list
│   │
│   ├── user/                 # User profiles
│   │   └── [username]/
│   │
│   ├── admin/                # Admin panel
│   ├── ai-studio/            # AI features
│   └── ...
│
├── components/               # Reusable components
│   ├── ui/                   # UI primitives
│   │   ├── Avatar.jsx
│   │   ├── Badge.jsx
│   │   ├── Button.jsx
│   │   ├── ThreadCard.jsx
│   │   └── ...
│   │
│   ├── Header.jsx            # Global header
│   ├── Footer.jsx            # Global footer
│   ├── CommandPalette.jsx    # Cmd+K menu
│   └── ...
│
├── lib/                      # Utilities
│   ├── api.js                # API client
│   ├── auth.js               # Auth helpers
│   ├── utils.js              # General utilities
│   ├── ThemeContext.js       # Theme provider
│   └── useKeyboardShortcuts.js
│
├── public/                   # Static assets
│   ├── logo/
│   └── ...
│
├── eslint.config.mjs         # ESLint config
├── next.config.mjs           # Next.js config
├── package.json
├── postcss.config.mjs
├── tailwind.config.js
└── tsconfig.json
```

---

## Available Scripts

```bash
# Development
npm run dev           # Start dev server (port 3000)

# Build
npm run build         # Production build
npm run start         # Start production server

# Quality
npm run lint          # Run ESLint
npm run typecheck     # TypeScript type check
npm run format        # Format with Prettier
```

---

## Key Features

### Command Palette (Cmd+K)
- Quick navigation across the app
- Search threads, users, settings
- Theme switching

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+/` | Focus search |
| `?` | Show shortcuts help |
| `G` then `H` | Go to Home |
| `G` then `T` | Go to Threads |
| `N` | New thread |

### Theme System
- Light / Dark / System modes
- Smooth transitions
- Persisted preference

### Accessibility
- Skip to main content link
- Keyboard navigation
- ARIA labels
- Reduced motion support

---

## Environment Variables

```env
# API URLs
NEXT_PUBLIC_BACKEND_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_URL=https://feature.alephdraad.fun

# App Config
NEXT_PUBLIC_APP_NAME=Alephdraad
NEXT_PUBLIC_APP_URL=https://alephdraad.fun
```

---

## Component Guidelines

### Import Patterns

```jsx
// Default exports
import ThreadCard from "@/components/ui/ThreadCard";
import Avatar from "@/components/ui/Avatar";

// Named exports
import { Badge, BadgeChip } from "@/components/ui/Badge";
import { Button, ButtonGroup } from "@/components/ui/Button";
```

### Common Patterns

```jsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";

export default function MyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const API = getApiBase();

  useEffect(() => {
    fetch(`${API}/api/endpoint`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [API]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <NotFound />;

  return <div>{/* content */}</div>;
}
```

---

## Deployment

### Vercel (Recommended)

1. Connect GitHub repository
2. Set environment variables
3. Deploy

### Manual Build

```bash
npm run build
npm run start
```

---

## Changelog

### January 12, 2026
- Fixed ThreadCard import error (default export)
- Removed outdated PHASE6 documentation files

---

*See main [README.md](../README.md) for full project documentation.*
