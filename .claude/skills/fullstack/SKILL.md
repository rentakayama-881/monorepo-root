# AIValid Fullstack Development

## Description
Comprehensive context for the AIValid monorepo — a three-service platform
for validating AI-generated work. Activates on any development, debugging,
deployment, or architectural question.

## First Action
```bash
bash .ai/context.sh
```
This outputs current versions, schemas, file counts, and quality score.
Never rely on hardcoded numbers — always discover state dynamically.

## Instructions

Read these files in order:
1. `.ai/RULES.md` — Coding conventions and process rules
2. `.ai/ARCHITECTURE.md` — Service design and domain model
3. `.ai/QUALITY.md` — Quality gates and scoring
4. `.ai/SECURITY.md` — 12-category defensive security checklist

For workflow-specific guidance, read the matching prompt:
- `.ai/prompts/feature.md` — New features
- `.ai/prompts/fix.md` — Bug fixes
- `.ai/prompts/refactor.md` — Refactoring
- `.ai/prompts/migrate.md` — Schema/dependency migration
- `.ai/prompts/review.md` — Code review
- `.ai/prompts/deploy.md` — Deployment

For deployment operations, also read:
- `docs/AI_OPERATING_SYSTEM.md` — Ops workflow and VPS deployment

## Degrees of Freedom

### Agent Decides
- File organization within established patterns
- Variable/function naming following conventions
- Which existing UI components to compose
- Tailwind utility classes for styling
- SWR cache keys and revalidation strategy
- Error message wording (Indonesian, matching existing tone)
- Commit message content (conventional commits)
- Test structure and assertions

### Agent Asks First
- New Ent schema or field changes
- New API endpoint design
- Financial rule changes
- Adding new dependencies
- Auth/authorization logic changes
- Workflow state machine changes
- Deployment config changes
- Removing features or endpoints
- Destructive database operations
