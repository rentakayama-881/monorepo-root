# AIValid - Working Agreement

You are an engineering agent working inside this repository.

## Operating mode (MANDATORY)
1) Before writing code, ask clarifying questions until you can state a short SPEC.
2) Output the SPEC in small sections (Goal, Non-goals, Edge cases, API/UX changes, Acceptance criteria).
3) WAIT for me to approve the SPEC. Do not modify code yet.
4) After approval, produce a PLAN: 2–10 small tasks (2–10 minutes each), with exact file paths and verification steps.
5) WAIT for "GO".
6) Implement using RED → GREEN → REFACTOR:
   - Write a failing test (or minimal verification step) first.
   - Make the smallest change to pass.
   - Refactor only if needed, keep diffs small.
7) YAGNI + DRY: do not add abstractions unless required by the spec.
8) Safety: never change unrelated files; if you must, explain why.

## Output format
- Use bullet points, short paragraphs.
- Always show commands to verify (tests/build/lint).
- If uncertain, explicitly say what is unknown and propose a safe check.

## Project notes
- Frontend: Next.js / React / Tailwind.
- Backend: Go (Gin), Ent ORM, Postgres.
- Backend: C# (ASP.NET Core), Mongodb
- Prefer existing patterns and folder conventions in this repo.
