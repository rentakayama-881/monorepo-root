#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${ROOT_DIR}/.quality/quality-baseline-${TIMESTAMP}.log"
LANE="quick"
GATE_TIMEOUT_SECONDS="${GATE_TIMEOUT_SECONDS:-1200}"

usage() {
  cat <<'EOF'
Usage: quality-baseline.sh [--log <path>] [--lane quick|full] [--timeout-seconds <int>]

Examples:
  quality-baseline.sh
  quality-baseline.sh --log .quality/baseline.log
  quality-baseline.sh --lane full --timeout-seconds 1800

Notes:
  - quick lane runs mandatory PR-level quality gates.
  - full lane runs quick lane + heavier checks (race/build/security).
EOF
}

while (($# > 0)); do
  case "$1" in
    --log)
      LOG_FILE="$2"
      shift 2
      ;;
    --lane)
      LANE="$2"
      shift 2
      ;;
    --timeout-seconds)
      GATE_TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "${LOG_FILE_OVERRIDE_APPLIED:-}" ]]; then
        LOG_FILE="$1"
        LOG_FILE_OVERRIDE_APPLIED="1"
        shift 1
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ "${LANE}" != "quick" && "${LANE}" != "full" ]]; then
  echo "Invalid lane: ${LANE} (expected quick|full)" >&2
  exit 1
fi

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
  local timeout_seconds="$4"

  log "[gate] ${name}: START (timeout=${timeout_seconds}s)"
  if (cd "${ROOT_DIR}/${dir}" && timeout --signal=TERM "${timeout_seconds}" bash -lc "${cmd}") >>"${LOG_FILE}" 2>&1; then
    log "[gate] ${name}: PASS"
    printf '%s\n' "${name}=PASS" >>"${RESULTS_FILE}"
    return 0
  fi

  local status=$?
  if [ "${status}" -eq 124 ]; then
    log "[gate] ${name}: TIMEOUT"
    printf '%s\n' "${name}=TIMEOUT" >>"${RESULTS_FILE}"
    return 1
  fi

  log "[gate] ${name}: FAIL"
  printf '%s\n' "${name}=FAIL" >>"${RESULTS_FILE}"
  return 1
}

main() {
  local failed=0
  RESULTS_FILE="$(mktemp)"
  trap 'rm -f "${RESULTS_FILE}"' EXIT

  log "[meta] root=${ROOT_DIR}"
  log "[meta] log=${LOG_FILE}"
  log "[meta] lane=${LANE}"
  log "[meta] timeout_seconds=${GATE_TIMEOUT_SECONDS}"
  log "[meta] started_at_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  run_gate "backend-vet-test" "backend" "go vet ./... && go test -v ./..." "${GATE_TIMEOUT_SECONDS}" || failed=1
  run_gate "feature-service-build-test" "feature-service" "dotnet build --configuration Release && dotnet test --configuration Release --nologo" "${GATE_TIMEOUT_SECONDS}" || failed=1
  run_gate "frontend-lint-type-test" "frontend" "npm run lint && npm run typecheck && npm test -- --ci --runInBand" "${GATE_TIMEOUT_SECONDS}" || failed=1

  if [ "${LANE}" = "full" ]; then
    run_gate "backend-race-test" "backend" "go test -v -race ./..." "${GATE_TIMEOUT_SECONDS}" || failed=1
    run_gate "frontend-build" "frontend" "SKIP_PREBUILD_CHECK=1 npm run build" "${GATE_TIMEOUT_SECONDS}" || failed=1
    run_gate "frontend-prod-audit" "frontend" "npm audit --omit=dev --audit-level=high" "${GATE_TIMEOUT_SECONDS}" || failed=1
  fi

  log "[summary] gate_statuses_begin"
  while IFS= read -r line; do
    log "[summary] ${line}"
  done <"${RESULTS_FILE}"
  log "[summary] gate_statuses_end"
  log "[meta] finished_at_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  if [ "${failed}" -ne 0 ]; then
    log "[result] FAIL"
    exit 1
  fi

  log "[result] PASS"
}

main "$@"
