#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${1:-${ROOT_DIR}/.quality/quality-baseline-${TIMESTAMP}.log}"

mkdir -p "$(dirname "${LOG_FILE}")"
mkdir -p "${ROOT_DIR}/.cache/go-build" "${ROOT_DIR}/.cache/go-mod" "${ROOT_DIR}/.cache/dotnet" "${ROOT_DIR}/.cache/nuget"

export GOCACHE="${GOCACHE:-${ROOT_DIR}/.cache/go-build}"
export GOMODCACHE="${GOMODCACHE:-${ROOT_DIR}/.cache/go-mod}"
export DOTNET_CLI_HOME="${DOTNET_CLI_HOME:-${ROOT_DIR}/.cache/dotnet}"
export NUGET_PACKAGES="${NUGET_PACKAGES:-${ROOT_DIR}/.cache/nuget}"

log() {
  local line="$1"
  echo "${line}" | tee -a "${LOG_FILE}"
}

run_gate() {
  local name="$1"
  local dir="$2"
  local cmd="$3"

  log "[gate] ${name}: START"
  if (cd "${ROOT_DIR}/${dir}" && bash -lc "${cmd}") >>"${LOG_FILE}" 2>&1; then
    log "[gate] ${name}: PASS"
    return 0
  fi

  log "[gate] ${name}: FAIL"
  return 1
}

main() {
  local failed=0

  log "[meta] root=${ROOT_DIR}"
  log "[meta] log=${LOG_FILE}"

  run_gate "backend" "backend" "go vet ./... && go test -v -race ./..." || failed=1
  run_gate "feature-service" "feature-service" "dotnet build --configuration Release && dotnet test --configuration Release" || failed=1
  run_gate "frontend" "frontend" "npm run lint && npm run typecheck && npm test -- --ci --forceExit" || failed=1

  if [ "${failed}" -ne 0 ]; then
    log "[result] FAIL"
    exit 1
  fi

  log "[result] PASS"
}

main "$@"
