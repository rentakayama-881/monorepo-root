const requiredServerBase = String(process.env.API_BASE_URL || "").trim();

if (!requiredServerBase) {
  console.error("[prebuild-check] API_BASE_URL is required for static server-side data fetching.");
  console.error("[prebuild-check] Example: API_BASE_URL=https://api.aivalid.id");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(requiredServerBase);
} catch {
  console.error("[prebuild-check] API_BASE_URL is invalid:", requiredServerBase);
  process.exit(1);
}

const healthUrl = new URL("/api/health", baseUrl);

try {
  const response = await fetch(healthUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    console.error(`[prebuild-check] Health check failed with status ${response.status} on ${healthUrl.toString()}`);
    process.exit(1);
  }

  console.log(`[prebuild-check] OK: ${healthUrl.toString()}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[prebuild-check] Unable to reach API health endpoint: ${message}`);
  process.exit(1);
}
