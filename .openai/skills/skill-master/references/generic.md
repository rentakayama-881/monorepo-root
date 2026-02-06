# Generic/Unknown Stack

Fallback reference when no specific platform is detected.

## Detection signals
- No specific build/config files found
- Mixed technology stack
- Documentation-only repository

## Multi-module signals
- Multiple directories with separate concerns
- `packages/`, `modules/`, `libs/` directories
- Monorepo structure without specific tooling

## Pre-generation sources
- `README.md` (project overview)
- `docs/*` (documentation)
- `.env.example` (environment vars)
- `docker-compose.yml` (services)
- CI files (`.github/workflows/`, etc.)

## Codebase scan patterns

### Source roots
- `src/`, `lib/`, `app/`

### Layer/folder patterns (record if present)
`api/`, `core/`, `utils/`, `services/`, `models/`, `config/`, `scripts/`

### Generic pattern indicators

| Pattern | Detection Criteria | Skill Name |
|---------|-------------------|------------|
| Entry Point | `main.*`, `index.*`, `app.*` | entry-point |
| Config | `config.*`, `settings.*` | config-file |
| API Client | `fetch(`, `axios`, `requests.` | api-client |
| Service Layer | `*Service`, `services/` | service-layer |
| Repository | `*Repository`, `repositories/` | repository-pattern |
| Model/Entity | `*Model`, `*Entity`, `models/` | model-entity |
| Unit Test | `test`, `spec`, `assert` | unit-test |

## Mandatory output sections

Include if detected:
- **Project modules**: major directories and responsibilities
- **Runtime/build entrypoints**: main commands and startup files
- **Service boundaries**: API, workers, scripts
- **Configuration surfaces**: env/config files
- **Test layout**: where and how tests are organized

## Command sources
- README/docs and CI workflows
- Build or task files (Makefile, package scripts, etc.)
- Only include commands present in repo

## Key paths
- `src/`, `lib/`, `app/`
- `config/`, `scripts/`
- `tests/`, `test/`, `spec/`
- `docs/`
