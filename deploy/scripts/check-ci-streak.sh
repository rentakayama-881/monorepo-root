#!/usr/bin/env bash
set -euo pipefail

TARGET=10
INPUT_PATH=""

usage() {
  cat <<'EOF'
Usage: check-ci-streak.sh --input <file-or-directory> [--target <n>]

Examples:
  check-ci-streak.sh --input .quality/ci-stability
  check-ci-streak.sh --input ./ci-stability-snapshots.json --target 10

Input format:
  - JSON object, JSON array, or newline-delimited JSON records.
  - Expected keys per record: lane, result, timestamp_utc (recommended), run_id.
EOF
}

while (($# > 0)); do
  case "$1" in
    --input)
      INPUT_PATH="$2"
      shift 2
      ;;
    --target)
      TARGET="$2"
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

if [ -z "${INPUT_PATH}" ]; then
  echo "--input is required" >&2
  usage
  exit 1
fi

if ! [[ "${TARGET}" =~ ^[0-9]+$ ]] || [ "${TARGET}" -le 0 ]; then
  echo "--target must be a positive integer" >&2
  exit 1
fi

node - "${INPUT_PATH}" "${TARGET}" <<'NODE'
const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
const target = Number(process.argv[3] || "10");

function parseRecords(content) {
  const trimmed = String(content || "").trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch (_) {
    // Fall back to JSONL parsing below.
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const records = [];
  for (const line of lines) {
    try {
      const value = JSON.parse(line);
      if (Array.isArray(value)) records.push(...value);
      else if (value && typeof value === "object") records.push(value);
    } catch (_) {
      // Ignore malformed lines so one bad record does not block summary.
    }
  }
  return records;
}

function readAllRecords(pathOrFile) {
  if (!fs.existsSync(pathOrFile)) {
    throw new Error(`input path not found: ${pathOrFile}`);
  }

  const stat = fs.statSync(pathOrFile);
  if (stat.isDirectory()) {
    const files = fs
      .readdirSync(pathOrFile)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(pathOrFile, file));
    const out = [];
    for (const file of files) {
      out.push(...parseRecords(fs.readFileSync(file, "utf8")));
    }
    return out;
  }

  return parseRecords(fs.readFileSync(pathOrFile, "utf8"));
}

function normalizedResult(value) {
  const s = String(value || "").toLowerCase();
  if (s === "pass") return "success";
  if (s === "fail") return "failure";
  return s || "unknown";
}

function sortNewestFirst(records) {
  return [...records].sort((a, b) => {
    const tsA = Date.parse(a.timestamp_utc || "") || 0;
    const tsB = Date.parse(b.timestamp_utc || "") || 0;
    if (tsA !== tsB) return tsB - tsA;

    const runA = Number(a.run_id || 0);
    const runB = Number(b.run_id || 0);
    return runB - runA;
  });
}

function streakForLane(records, laneName) {
  const laneRecords = sortNewestFirst(
    records.filter((r) => String(r.lane || "").toLowerCase() === laneName)
  );
  let streak = 0;
  for (const record of laneRecords) {
    if (normalizedResult(record.result) === "success") streak += 1;
    else break;
  }
  return {
    streak,
    total: laneRecords.length,
    latest: laneRecords[0] || null,
  };
}

const records = readAllRecords(inputPath);
const quick = streakForLane(records, "quick");
const full = streakForLane(records, "full");
const meetsTarget = quick.streak >= target && full.streak >= target;

console.log("## CI Streak Summary");
console.log(`- Input: ${inputPath}`);
console.log(`- Target streak: ${target}`);
console.log(`- quick streak: ${quick.streak} (records=${quick.total})`);
console.log(`- full streak: ${full.streak} (records=${full.total})`);
console.log(`- meets_target: ${meetsTarget}`);
console.log("");
console.log("quick_streak=" + quick.streak);
console.log("full_streak=" + full.streak);
console.log("meets_target=" + String(meetsTarget));
NODE
