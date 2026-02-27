#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command git

deploy_mode="auto" # auto|yes|no
preflight_scope="all" # all|backend|backend-feature|frontend

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy-vps)
      deploy_mode="yes"
      shift
      ;;
    --skip-deploy)
      deploy_mode="no"
      shift
      ;;
    --scope)
      preflight_scope="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  die "Usage: ./ops/commit-push.sh [--deploy-vps|--skip-deploy] [--scope all|backend|backend-feature|frontend] \"type(scope): message\""
fi

if [[ "$preflight_scope" != "all" && "$preflight_scope" != "backend" && "$preflight_scope" != "backend-feature" && "$preflight_scope" != "frontend" ]]; then
  die "Invalid --scope value: $preflight_scope (allowed: all|backend|backend-feature|frontend)"
fi

commit_message="$*"

cd "$OPS_ROOT"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" == "HEAD" ]]; then
  die "Detached HEAD is not allowed for commit+push workflow."
fi

if [[ -z "$(git status --porcelain)" ]]; then
  die "Working tree is clean. Nothing to commit."
fi

run_step "preflight gates ($preflight_scope)" "$OPS_ROOT/ops/preflight-full.sh" --scope "$preflight_scope"

run_step "git add" git add -A

if git diff --cached --quiet; then
  die "No staged changes detected after git add."
fi

run_step "git commit" git commit -m "$commit_message"
run_step "git push" git push origin "$current_branch"

origin_url="$(git config --get remote.origin.url || true)"
if [[ "$origin_url" =~ github\.com[:/]([^/]+/[^/]+)\.git$ ]]; then
  repo="${BASH_REMATCH[1]}"
  log "INFO" "Open PR: https://github.com/$repo/pull/new/$current_branch"
fi

should_deploy="false"
if [[ "$deploy_mode" == "yes" ]]; then
  should_deploy="true"
elif [[ "$deploy_mode" == "auto" && "$current_branch" == "main" && "$preflight_scope" != "frontend" ]]; then
  should_deploy="true"
fi

if [[ "$should_deploy" == "true" ]]; then
  target_sha="$(git rev-parse HEAD)"
  run_step "sync VPS to latest sha $target_sha" \
    "$OPS_ROOT/ops/vps-sync-deploy.sh" --env prod --ref "$target_sha"
elif [[ "$deploy_mode" == "auto" && "$current_branch" == "main" && "$preflight_scope" == "frontend" ]]; then
  log "INFO" "Skipping VPS deploy for frontend-only scope on main."
fi

log "OK" "Commit+push workflow completed on branch $current_branch"
