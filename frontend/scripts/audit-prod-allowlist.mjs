#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const allowedAdvisories = new Set([
  "@sentry/nextjs",
  "@sentry/node",
  "minimatch",
  // Transitive via @sentry/nextjs build toolchain.
  "rollup",
]);

function fail(message, details = "") {
  console.error(`[audit:prod] ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  fail("Failed to parse npm audit JSON output.", `${result.stdout || ""}\n${result.stderr || ""}`.trim());
}

if (report?.message && !report?.vulnerabilities) {
  fail("npm audit request failed.", String(report.message));
}

const vulnerabilities = report?.vulnerabilities && typeof report.vulnerabilities === "object"
  ? report.vulnerabilities
  : {};

const names = Object.keys(vulnerabilities);
if (names.length === 0) {
  console.log("[audit:prod] No production vulnerabilities found.");
  process.exit(0);
}

const unexpected = names.filter((name) => !allowedAdvisories.has(name));
if (unexpected.length > 0) {
  const details = unexpected.map((name) => {
    const vuln = vulnerabilities[name] || {};
    return `- ${name} (severity: ${vuln.severity || "unknown"})`;
  }).join("\n");
  fail("Unexpected production vulnerabilities detected.", details);
}

const criticalAllowed = names.filter((name) => String(vulnerabilities[name]?.severity || "").toLowerCase() === "critical");
if (criticalAllowed.length > 0) {
  fail(
    "Critical vulnerability detected in allowlist set.",
    criticalAllowed.map((name) => `- ${name}`).join("\n"),
  );
}

console.log("[audit:prod] Only allowlisted upstream advisories are present:");
for (const name of names) {
  const vuln = vulnerabilities[name] || {};
  console.log(`- ${name} (severity: ${vuln.severity || "unknown"})`);
}

process.exit(0);
