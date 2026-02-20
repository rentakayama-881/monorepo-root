#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <quality-log-file>" >&2
  exit 1
fi

LOG_FILE="$1"
if [ ! -f "${LOG_FILE}" ]; then
  echo "Log file not found: ${LOG_FILE}" >&2
  exit 1
fi

declare -A GATES=()

while IFS= read -r line; do
  if [[ "${line}" =~ ^\[summary\]\ ([^=]+)=(PASS|FAIL|TIMEOUT)$ ]]; then
    GATES["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
    continue
  fi

  if [[ "${line}" =~ ^\[gate\]\ ([^:]+):\ (PASS|FAIL|TIMEOUT)$ ]]; then
    GATES["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
  fi
done < "${LOG_FILE}"

pass=0
fail=0
timeout=0
for status in "${GATES[@]:-}"; do
  case "${status}" in
    PASS) pass=$((pass + 1)) ;;
    FAIL) fail=$((fail + 1)) ;;
    TIMEOUT) timeout=$((timeout + 1)) ;;
  esac
done

result_line="$(grep -E "^\[result\] " "${LOG_FILE}" | tail -n 1 || true)"
overall="${result_line#\[result\] }"
if [ -z "${overall}" ]; then
  overall="UNKNOWN"
fi

score_band="90-100 (Excellent trajectory)"
if [ "${overall}" != "PASS" ]; then
  if [ "${fail}" -ge 2 ] || [ "${timeout}" -ge 1 ]; then
    score_band="0-69 (Risky)"
  else
    score_band="70-89 (Needs stabilization)"
  fi
fi

printf '%s\n' "## Auto Score Summary (Quality Baseline)"
printf '%s\n' "- Source log: ${LOG_FILE}"
printf '%s\n' "- Overall gate result: ${overall}"
printf '%s\n' "- Gate totals: pass=${pass}, fail=${fail}, timeout=${timeout}"
printf '%s\n' "- Initial score band (heuristic): ${score_band}"
printf '%s\n' ""
printf '%s\n' "### Gate statuses"
if [ "${#GATES[@]}" -eq 0 ]; then
  printf '%s\n' "- No gate statuses detected."
else
  for gate in "${!GATES[@]}"; do
    printf '%s\n' "- ${gate}: ${GATES[${gate}]}"
  done | sort
fi
