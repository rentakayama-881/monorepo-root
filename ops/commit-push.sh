#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command git

if [[ $# -lt 1 ]]; then
  die "Usage: ./ops/commit-push.sh \"type(scope): message\""
fi

commit_message="$*"

cd "$OPS_ROOT"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" == "HEAD" ]]; then
  die "Detached HEAD is not allowed for commit+push workflow."
fi

if [[ "$current_branch" == "main" && "${ALLOW_MAIN_PUSH:-0}" != "1" ]]; then
  die "Direct push from main is blocked. Create a working branch first or set ALLOW_MAIN_PUSH=1 intentionally."
fi

if [[ -z "$(git status --porcelain)" ]]; then
  die "Working tree is clean. Nothing to commit."
fi

run_step "preflight full gates" "$OPS_ROOT/ops/preflight-full.sh"

run_step "git add" git add -A

if git diff --cached --quiet; then
  die "No staged changes detected after git add."
fi

run_step "git commit" git commit -m "$commit_message"
run_step "git push" git push -u origin "$current_branch"

origin_url="$(git config --get remote.origin.url || true)"
if [[ "$origin_url" =~ github\.com[:/]([^/]+/[^/]+)\.git$ ]]; then
  repo="${BASH_REMATCH[1]}"
  log "INFO" "Open PR: https://github.com/$repo/pull/new/$current_branch"
fi

log "OK" "Commit+push workflow completed on branch $current_branch"
