#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR=".quality/ci-stability"
LIMIT=100
REPO=""
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

usage() {
  cat <<'EOF'
Usage: collect-ci-stability.sh [--repo <owner/repo>] [--output <dir>] [--limit <n>]

Examples:
  collect-ci-stability.sh --repo rentakayama-881/monorepo-root
  collect-ci-stability.sh --output .quality/ci-stability --limit 50

Auth:
  Requires GITHUB_TOKEN or GH_TOKEN with actions:read permission.

Output:
  Downloads CI stability artifact JSON files into output directory.
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
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
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

if [ -z "${TOKEN}" ]; then
  echo "Missing token. Set GITHUB_TOKEN or GH_TOKEN." >&2
  exit 1
fi

if ! [[ "${LIMIT}" =~ ^[0-9]+$ ]] || [ "${LIMIT}" -le 0 ]; then
  echo "--limit must be a positive integer" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
manifest_file="${OUTPUT_DIR}/manifest.jsonl"
: > "${manifest_file}"

downloaded=0
page=1

auth_header="Authorization: Bearer ${TOKEN}"
accept_header="Accept: application/vnd.github+json"
version_header="X-GitHub-Api-Version: 2022-11-28"

while [ "${downloaded}" -lt "${LIMIT}" ]; do
  response="$(curl -fsSL \
    -H "${auth_header}" \
    -H "${accept_header}" \
    -H "${version_header}" \
    "https://api.github.com/repos/${REPO}/actions/artifacts?per_page=100&page=${page}")"

  entries="$(printf '%s' "${response}" | node -e '
    let input = "";
    process.stdin.on("data", (c) => (input += c));
    process.stdin.on("end", () => {
      const data = JSON.parse(input || "{}");
      const artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
      for (const artifact of artifacts) {
        const name = String(artifact.name || "");
        if (!name.startsWith("ci-stability-report-")) continue;
        const row = [
          name,
          String(artifact.archive_download_url || ""),
          String(Boolean(artifact.expired)),
          String(artifact.created_at || "")
        ].join("\t");
        console.log(row);
      }
    });
  ')"

  if [ -z "${entries}" ]; then
    break
  fi

  while IFS=$'\t' read -r name url expired created_at; do
    [ -z "${name}" ] && continue
    if [ "${expired}" = "true" ] || [ -z "${url}" ]; then
      continue
    fi
    if [ "${downloaded}" -ge "${LIMIT}" ]; then
      break
    fi

    tmp_zip="$(mktemp)"
    curl -fsSL -L \
      -H "${auth_header}" \
      -H "${accept_header}" \
      -H "${version_header}" \
      "${url}" -o "${tmp_zip}"
    unzip -qo "${tmp_zip}" -d "${OUTPUT_DIR}"
    rm -f "${tmp_zip}"

    printf '{"name":"%s","created_at":"%s"}\n' "${name}" "${created_at}" >> "${manifest_file}"
    downloaded=$((downloaded + 1))
  done <<< "${entries}"

  page=$((page + 1))
done

echo "Downloaded ${downloaded} ci-stability artifacts to ${OUTPUT_DIR}"
echo "Manifest: ${manifest_file}"
