/**
 * Stress Test — AIValid Platform
 *
 * Ramps concurrent users up to 50 on the health endpoints
 * to find breaking points and measure degradation.
 *
 * Usage:
 *   k6 run tests/load/stress.js
 *
 * Override URLs:
 *   k6 run -e BASE_URL_API=http://localhost:8080 tests/load/stress.js
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

// ---------------------------------------------------------------------------
// Configurable base URLs
// ---------------------------------------------------------------------------
const BASE_URL_API = __ENV.BASE_URL_API || "https://api.aivalid.id";
const BASE_URL_FEATURE = __ENV.BASE_URL_FEATURE || "https://feature.aivalid.id";

// ---------------------------------------------------------------------------
// k6 options — staged ramp-up / ramp-down
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: "30s", target: 50 },  // ramp up to 50 VUs
    { duration: "1m", target: 50 },   // hold at 50 VUs
    { duration: "30s", target: 0 },   // ramp down to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    errors: ["rate<0.05"],
    api_health_duration: ["p(95)<2000"],
    feature_health_duration: ["p(95)<2000"],
  },
};

// ---------------------------------------------------------------------------
// Default iteration
// ---------------------------------------------------------------------------
export default function () {
  // --- Go backend health -----------------------------------------------------
  group("Stress: Go Backend /health", () => {
    const res = http.get(`${BASE_URL_API}/health`, {
      tags: { name: "GET /health (api)" },
    });

    apiHealthDuration.add(res.timings.duration);

    const ok = check(res, {
      "api status 200": (r) => r.status === 200,
    });

    errorRate.add(!ok);
  });

  sleep(0.3);

  // --- Feature service health ------------------------------------------------
  group("Stress: Feature Service /api/v1/health", () => {
    const res = http.get(`${BASE_URL_FEATURE}/api/v1/health`, {
      tags: { name: "GET /api/v1/health (feature)" },
    });

    featureHealthDuration.add(res.timings.duration);

    const ok = check(res, {
      "feature status 200": (r) => r.status === 200,
    });

    errorRate.add(!ok);
  });

  sleep(0.3);
}
