# 2025/2026 UI Engineering Standards (Tokens-Only)

Use this when asked to modernize UI, redesign components, or improve UX.

## Non-negotiables

- **Responsive-first**: verify mobile → tablet → desktop behavior with actual layout/CSS evidence.
- **Tokens-only color discipline**: use existing design tokens (e.g., CSS variables in `globals.css`); do not invent a new palette.
- **Accessibility**: keyboard navigation, visible focus, labels, ARIA where needed; avoid contrast regressions.
- **Micro-interactions**: subtle transitions; prefer `transform`/`opacity`; avoid perf-heavy animations.
- **Performance**: avoid unnecessary re-renders; measure when claiming perf wins.

## Evidence requirements for UI claims

For any non-trivial UI claim, include at least one:
- file excerpt showing token usage (CSS vars or token classes)
- build output (no errors) and/or lint output
- a deterministic UI check (e.g., storybook/screenshot test) if present in repo

## Implementation guidance (keep changes incremental)

- Prefer small, verifiable diffs.
- Maintain typography/spacing scale consistency.
- Use semantic HTML; improve focus management and form labeling.
- Avoid introducing new dependencies unless required and justified with repo evidence.

