# Stale-Doc Quarantine (Evidence-Based)

Treat documentation as untrusted until confirmed by current code or runtime behavior.

## What counts as stale

A doc is stale when it conflicts with current reality, such as:
- referenced code paths no longer exist
- endpoints/config mentioned are not registered/used in current code
- build/deploy instructions contradict current scripts/pipelines/service definitions

## Required: STALENESS REPORT

For each stale document, record:
- Doc file path
- Stale indicator (what conflicts)
- Evidence (repo excerpt, `rg` output, build/test output, or runtime logs)
- Recommended action (update/remove/mark deprecated)

## Fast evidence helpers

Broken relative links are a strong stale indicator:

```bash
python3 skills/local/repo-first-fullstack/scripts/check_docs_links.py --root .
```

Other common checks:

```bash
rg -n "localhost:|:3000|:8080|/api/" docs README.md -S
rg -n "docker-compose|systemctl|nginx" docs deploy -S
```

## Handling conflicts

When docs conflict with code:
- Prefer code as truth and proceed accordingly.
- If the doc is frequently encountered, update it or mark it deprecated (only when explicitly asked to edit docs).

