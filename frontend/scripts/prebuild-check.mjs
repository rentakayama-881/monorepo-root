const toBool = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

if (toBool(process.env.SKIP_PREBUILD_CHECK, false)) {
  console.warn("[prebuild-check] SKIP_PREBUILD_CHECK=true, skipping API health prebuild check.");
  process.exit(0);
}

const requiredServerBase = String(process.env.API_BASE_URL || "").trim();
const healthPath = String(process.env.API_HEALTH_PATH || "/api/health").trim() || "/api/health";
const strictMode = toBool(process.env.PREBUILD_HEALTHCHECK_STRICT, true);

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

const healthUrl = new URL(healthPath, baseUrl);

try {
  const response = await fetch(healthUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const msg = `[prebuild-check] Health check failed with status ${response.status} on ${healthUrl.toString()}`;
    if (strictMode) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`${msg} (continuing because PREBUILD_HEALTHCHECK_STRICT=false)`);
    process.exit(0);
  }

  console.log(`[prebuild-check] OK: ${healthUrl.toString()}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const msg = `[prebuild-check] Unable to reach API health endpoint: ${message}`;
  if (strictMode) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg} (continuing because PREBUILD_HEALTHCHECK_STRICT=false)`);
  process.exit(0);
}
