#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root (or via sudo)." >&2
  exit 1
fi

TS="${TS:-$(date -u +%Y%m%dT%H%M%SZ)}"

BACKEND_ARTIFACT="${BACKEND_ARTIFACT:-/tmp/alephdraad-backend-app}"
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
if [ -f /opt/alephdraad/backend/app ]; then
  cp -a /opt/alephdraad/backend/app "/opt/alephdraad/backend/app.bak.$TS"
fi
if [ -f /opt/alephdraad/feature-service/FeatureService.Api.dll ]; then
  cp -a /opt/alephdraad/feature-service/FeatureService.Api.dll "/opt/alephdraad/feature-service/FeatureService.Api.dll.bak.$TS"
fi

echo "[deploy] installing new binaries"
install -m 0755 -o root -g root "$BACKEND_ARTIFACT" /opt/alephdraad/backend/app
install -m 0644 -o root -g root "$FEATURE_DLL_ARTIFACT" /opt/alephdraad/feature-service/FeatureService.Api.dll

if [ -f "$FEATURE_PDB_ARTIFACT" ]; then
  install -m 0644 -o root -g root "$FEATURE_PDB_ARTIFACT" /opt/alephdraad/feature-service/FeatureService.Api.pdb
fi
if [ -f "$FEATURE_XML_ARTIFACT" ]; then
  install -m 0644 -o root -g root "$FEATURE_XML_ARTIFACT" /opt/alephdraad/feature-service/FeatureService.Api.xml
fi

echo "[deploy] restarting services"
systemctl restart alephdraad-backend
systemctl restart feature-service
systemctl is-active alephdraad-backend feature-service

echo "[deploy] health checks"
curl -fsS http://127.0.0.1:8080/api/health >/dev/null && echo "OK: backend /api/health"
curl -fsS http://127.0.0.1:5000/api/v1/health >/dev/null && echo "OK: feature-service /api/v1/health"

echo "[deploy] done"
echo
echo "Rollback (manual):"
echo "  cp -a /opt/alephdraad/backend/app.bak.$TS /opt/alephdraad/backend/app && systemctl restart alephdraad-backend"
echo "  cp -a /opt/alephdraad/feature-service/FeatureService.Api.dll.bak.$TS /opt/alephdraad/feature-service/FeatureService.Api.dll && systemctl restart feature-service"

