/**
 * Auth Flow Test — AIValid Platform
 *
 * Simulates login attempts against the Go backend.
 * Uses placeholder credentials — replace with test-account values
 * or pass them via environment variables.
 *
 * Usage:
 *   k6 run tests/load/auth-flow.js
 *
 * With real test credentials:
 *   k6 run \
 *     -e TEST_EMAIL=test@example.com \
 *     -e TEST_PASSWORD=supersecret \
 *     tests/load/auth-flow.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const loginErrorRate = new Rate("login_errors");
const loginDuration = new Trend("login_duration", true);

// ---------------------------------------------------------------------------
// Configurable values
// ---------------------------------------------------------------------------
const BASE_URL_API = __ENV.BASE_URL_API || "https://api.aivalid.id";
const TEST_EMAIL = __ENV.TEST_EMAIL || "loadtest@example.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest_P@ssw0rd!";

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  vus: 10,
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    login_errors: ["rate<0.05"], // allow higher error rate (test creds may not exist)
    login_duration: ["p(95)<1000"],
  },
};

// ---------------------------------------------------------------------------
// Default iteration
// ---------------------------------------------------------------------------
export default function () {
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    tags: { name: "POST /api/v1/auth/login" },
  };

  const res = http.post(
    `${BASE_URL_API}/api/v1/auth/login`,
    payload,
    params,
  );

  loginDuration.add(res.timings.duration);

  // When using placeholder credentials the backend will return 401.
  // We still consider the request successful if the backend responded
  // within a reasonable time — the goal is latency measurement, not
  // functional correctness.
  const ok = check(res, {
    "login responds (2xx or 401)": (r) =>
      r.status === 200 || r.status === 401,
    "login response has body": (r) => r.body && r.body.length > 0,
    "login p95 < 1s": (r) => r.timings.duration < 1000,
  });

  loginErrorRate.add(!ok);

  // If login succeeds, exercise an authenticated endpoint.
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const token = body.token || body.accessToken || "";

      if (token) {
        const meRes = http.get(`${BASE_URL_API}/api/v1/account/me`, {
          headers: { Authorization: `Bearer ${token}` },
          tags: { name: "GET /api/v1/account/me" },
        });

        check(meRes, {
          "account/me status 200": (r) => r.status === 200,
        });
      }
    } catch (_) {
      // parse failure — ignore
    }
  }

  sleep(1);
}
