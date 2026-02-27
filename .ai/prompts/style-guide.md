# Frontend Style Guide

## Trigger
Use this guide for ANY frontend change: new page, component, layout fix, or styling.

## Step 1: Discover

Run `bash .ai/context.sh` to see current frontend state.

## Step 2: Design Tokens (oklch)

All colors use oklch() CSS custom properties defined in `frontend/app/globals.css`:

| Token | Purpose |
|-------|---------|
| `--background` | Page background |
| `--foreground` | Primary text |
| `--card` | Card/panel background |
| `--card-foreground` | Text on cards |
| `--primary` | Brand action (Harvard Crimson) |
| `--primary-foreground` | Text on primary |
| `--secondary` | Secondary actions |
| `--muted` | Subdued backgrounds |
| `--muted-foreground` | Subdued text |
| `--accent` | Hover/focus backgrounds |
| `--destructive` | Error/danger |
| `--border` | Borders |
| `--ring` | Focus rings |
| `--radius` | Border radius token |

Dark mode: All tokens swap automatically via `[data-theme="dark"]`.

## Step 3: Typography

- **Body:** Source Sans 3 (`font-sans`)
- **Headings:** Source Serif 4 (`font-serif`)
- **Code:** Geist Mono (`font-mono`)

Scale:
- Page title: `text-2xl font-bold font-serif` (mobile) / `text-3xl` (desktop)
- Section heading: `text-xl font-semibold font-serif`
- Card title: `text-lg font-semibold`
- Body: `text-sm` or `text-base`
- Caption/meta: `text-xs text-muted-foreground`
- All user-facing text is Indonesian.

## Step 4: Layout Patterns

### Page Container
```jsx
<main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
  {/* content */}
</main>
```

### Header (Sticky)
```jsx
<header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
  <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
    {/* logo left, nav right */}
  </div>
</header>
```

### Card
```jsx
<div className="rounded-[var(--radius)] border bg-card p-4 shadow-sm">
  {/* content */}
</div>
```

### Responsive Grid
```jsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {/* cards */}
</div>
```

## Step 5: Component Rules

1. **Always use existing UI primitives** from `components/ui/` — check what exists before creating new ones.
2. **`cn()` for conditional classes** — import from `@/lib/utils`.
3. **No inline styles** — use Tailwind utilities only.
4. **No raw color values** — use CSS custom property tokens.
5. **Responsive-first** — mobile layout first, `sm:` / `md:` / `lg:` breakpoints for larger.
6. **Transitions** — use `transition-colors` for hover states, `transition-transform` for motion.
7. **Focus states** — always include `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
8. **Dark mode** — use semantic tokens. Never use `dark:` prefix directly — the token system handles it.
9. **Icons** — inline SVG with `currentColor`, or existing icon components.
10. **Loading states** — skeleton with `animate-pulse bg-muted rounded-[var(--radius)]`.
11. **Empty states** — centered text with `text-muted-foreground` and optional illustration.

## Step 6: Spacing and Sizing

- **Section gap:** `space-y-6` or `gap-6`
- **Card padding:** `p-4` or `p-6` (larger cards)
- **Button padding:** `px-4 py-2` (default), `px-3 py-1.5` (small)
- **Input padding:** `px-3 py-2`
- **Border radius:** always `rounded-[var(--radius)]` (uses CSS token)
- **Max content width:** `max-w-5xl`

## Step 7: Accessibility (Mandatory)

1. All `<img>` must have `alt` attribute.
2. All interactive elements must have accessible labels.
3. Color contrast must meet WCAG AA.
4. All forms must have associated `<label>` elements.
5. Modal/dialog must have `role="dialog"` and `aria-modal="true"`.
6. Keyboard navigation must work (Escape closes modals, Tab navigates forms).

## Step 8: Anti-Patterns (Never Do)

- Never add `className="text-[#a51c30]"` — use `text-primary`.
- Never use `style={{}}` for layout — use Tailwind.
- Never create a new component if `components/ui/` has one.
- Never write `console.log` — use `lib/logger.js`.
- Never use `Math.random()` for IDs — use `crypto.randomUUID()`.
- Never hardcode Indonesian text in components — but all user-facing text IS Indonesian.
- Never use `dangerouslySetInnerHTML` unless rendering trusted markdown.
- Never exceed 500 lines per file — split into subcomponents.
