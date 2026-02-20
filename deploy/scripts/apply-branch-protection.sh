#!/usr/bin/env bash
set -euo pipefail

REPO=""
TOKEN="${GITHUB_ADMIN_TOKEN:-${GITHUB_TOKEN:-}}"
DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage: apply-branch-protection.sh [--repo <owner/repo>] [--dry-run]

Examples:
  apply-branch-protection.sh --repo rentakayama-881/monorepo-root
  GITHUB_ADMIN_TOKEN=... apply-branch-protection.sh --dry-run

Auth:
  Requires GITHUB_ADMIN_TOKEN or GITHUB_TOKEN with repo admin rights.

Behavior:
  Applies strict branch protection settings for:
  - main    -> required check: "✅ Quality Gate (Full Lane)"
  - develop -> required check: "✅ Quality Gate (Quick Lane)"
EOF
}

parse_repo_from_git() {
  local remote
  remote="$(git remote get-url origin 2>/dev/null || true)"
  if [[ "${remote}" =~ ^git@github\.com:([^/]+)/([^/]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
    return 0
  fi
  if [[ "${remote}" =~ ^https://github\.com/([^/]+)/([^/]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
    return 0
  fi
  return 1
}

while (($# > 0)); do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "${REPO}" ]; then
  REPO="$(parse_repo_from_git || true)"
fi

if [ -z "${REPO}" ]; then
  echo "Unable to determine repo. Use --repo <owner/repo>." >&2
  exit 1
fi

if [ -z "${TOKEN}" ] && [ "${DRY_RUN}" != "true" ]; then
  echo "Missing token. Set GITHUB_ADMIN_TOKEN or GITHUB_TOKEN." >&2
  exit 1
fi

apply_rule() {
  local branch="$1"
  local required_check="$2"
  local endpoint="https://api.github.com/repos/${REPO}/branches/${branch}/protection"
  local payload
  local branch_exists_endpoint="https://api.github.com/repos/${REPO}/branches/${branch}"

  payload="$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {
        "context": "${required_check}"
      }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
)"

  echo "Applying branch protection for '${branch}' on '${REPO}'"
  if [ "${DRY_RUN}" = "true" ]; then
    echo "[dry-run] PUT ${endpoint}"
    echo "[dry-run] payload:"
    echo "${payload}"
    return 0
  fi

  if ! curl -fsSL \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${branch_exists_endpoint}" >/dev/null; then
    echo "Skip '${branch}': branch does not exist in '${REPO}'."
    return 0
  fi

  curl -fsSL -X PUT \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${endpoint}" \
    -d "${payload}" >/dev/null

  echo "Applied branch protection for '${branch}'"
}

apply_rule "main" "✅ Quality Gate (Full Lane)"
apply_rule "develop" "✅ Quality Gate (Quick Lane)"

echo "Done."
