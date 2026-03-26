/**
 * Smoke Test — AIValid Platform
 *
 * Quick sanity check for all public health/home endpoints.
 * No authentication required.
 *
 * Usage:
 *   k6 run tests/load/smoke.js
 *
 * Override URLs via environment variables:
 *   k6 run -e BASE_URL_API=http://localhost:8080 tests/load/smoke.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate("errors");
const apiHealthDuration = new Trend("api_health_duration", true);
const featureHealthDuration = new Trend("feature_health_duration", true);
const frontendDuration = new Trend("frontend_duration", true);

// ---------------------------------------------------------------------------
// Configurable base URLs (defaults to production)
// ---------------------------------------------------------------------------
const BASE_URL_API = __ENV.BASE_URL_API || "https://api.aivalid.id";
const BASE_URL_FEATURE = __ENV.BASE_URL_FEATURE || "https://feature.aivalid.id";
const BASE_URL_FRONTEND = __ENV.BASE_URL_FRONTEND || "https://aivalid.id";

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.01"],
    api_health_duration: ["p(95)<500"],
    feature_health_duration: ["p(95)<500"],
    frontend_duration: ["p(95)<500"],
  },
};

// ---------------------------------------------------------------------------
// Default iteration
// ---------------------------------------------------------------------------
export default function () {
  // --- Go backend health -----------------------------------------------------
  group("Go Backend /health", () => {
    const res = http.get(`${BASE_URL_API}/health`, {
      tags: { name: "GET /health (api)" },
    });

    apiHealthDuration.add(res.timings.duration);

    const ok = check(res, {
      "api status 200": (r) => r.status === 200,
      "api body has ok": (r) => {
        try {
          return JSON.parse(r.body).ok === true;
        } catch (_) {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // --- Feature service health ------------------------------------------------
  group("Feature Service /api/v1/health", () => {
    const res = http.get(`${BASE_URL_FEATURE}/api/v1/health`, {
      tags: { name: "GET /api/v1/health (feature)" },
    });

    featureHealthDuration.add(res.timings.duration);

    const ok = check(res, {
      "feature status 200": (r) => r.status === 200,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // --- Frontend home ---------------------------------------------------------
  group("Frontend /", () => {
    const res = http.get(`${BASE_URL_FRONTEND}/`, {
      tags: { name: "GET / (frontend)" },
    });

    frontendDuration.add(res.timings.duration);

    const ok = check(res, {
      "frontend status 200": (r) => r.status === 200,
      "frontend has html": (r) => r.body.includes("<!DOCTYPE html") || r.body.includes("<html"),
    });

    errorRate.add(!ok);
  });

  sleep(1);
}
