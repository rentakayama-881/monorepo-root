#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root (or via sudo)." >&2
  exit 1
fi

TS="${TS:-$(date -u +%Y%m%dT%H%M%SZ)}"

BACKEND_ARTIFACT="${BACKEND_ARTIFACT:-/tmp/aivalid-backend-app}"
FEATURE_DLL_ARTIFACT="${FEATURE_DLL_ARTIFACT:-/tmp/FeatureService.Api.dll}"
FEATURE_PDB_ARTIFACT="${FEATURE_PDB_ARTIFACT:-/tmp/FeatureService.Api.pdb}"
FEATURE_XML_ARTIFACT="${FEATURE_XML_ARTIFACT:-/tmp/FeatureService.Api.xml}"

echo "[deploy] timestamp: $TS"

if [ ! -f "$BACKEND_ARTIFACT" ]; then
  echo "ERROR: missing backend artifact: $BACKEND_ARTIFACT" >&2
  exit 1
fi

if [ ! -f "$FEATURE_DLL_ARTIFACT" ]; then
  echo "ERROR: missing feature-service artifact: $FEATURE_DLL_ARTIFACT" >&2
  exit 1
fi

echo "[deploy] backing up current binaries (if any)"
if [ -f /opt/aivalid/backend/app ]; then
  cp -a /opt/aivalid/backend/app "/opt/aivalid/backend/app.bak.$TS"
fi
if [ -f /opt/aivalid/feature-service/FeatureService.Api.dll ]; then
  cp -a /opt/aivalid/feature-service/FeatureService.Api.dll "/opt/aivalid/feature-service/FeatureService.Api.dll.bak.$TS"
fi

echo "[deploy] installing new binaries"
install -m 0755 -o root -g root "$BACKEND_ARTIFACT" /opt/aivalid/backend/app
install -m 0644 -o root -g root "$FEATURE_DLL_ARTIFACT" /opt/aivalid/feature-service/FeatureService.Api.dll

if [ -f "$FEATURE_PDB_ARTIFACT" ]; then
  install -m 0644 -o root -g root "$FEATURE_PDB_ARTIFACT" /opt/aivalid/feature-service/FeatureService.Api.pdb
fi
if [ -f "$FEATURE_XML_ARTIFACT" ]; then
  install -m 0644 -o root -g root "$FEATURE_XML_ARTIFACT" /opt/aivalid/feature-service/FeatureService.Api.xml
fi

echo "[deploy] restarting services"
systemctl restart aivalid-backend
systemctl restart feature-service
systemctl is-active aivalid-backend feature-service

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null; then
      echo "OK: $label"
      return 0
    fi
    sleep 1
  done

  echo "ERROR: healthcheck failed: $label ($url)" >&2
  curl -sS -i "$url" || true
  return 1
}

echo "[deploy] health checks (retry up to 30s)"
wait_for_url "http://127.0.0.1:8080/api/health" "backend /api/health"
wait_for_url "http://127.0.0.1:5000/api/v1/health" "feature-service /api/v1/health"

echo "[deploy] done"
echo
echo "Rollback (manual):"
echo "  cp -a /opt/aivalid/backend/app.bak.$TS /opt/aivalid/backend/app && systemctl restart aivalid-backend"
echo "  cp -a /opt/aivalid/feature-service/FeatureService.Api.dll.bak.$TS /opt/aivalid/feature-service/FeatureService.Api.dll && systemctl restart feature-service"
