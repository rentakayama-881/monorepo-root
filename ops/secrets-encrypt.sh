#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ops/secrets-encrypt.sh — Encrypt .env files with sops + age
#
# Usage:
#   bash ops/secrets-encrypt.sh [backend|feature-service|all]
#
# Reads the plaintext .env for a service and writes an
# encrypted .env.enc that is safe to commit to git.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command sops
ensure_command age

SCOPE="${1:-all}"

encrypt_env() {
  local service="$1"
  local env_file="$OPS_ROOT/$service/.env"
  local enc_file="$OPS_ROOT/$service/.env.enc"

  if [[ ! -f "$env_file" ]]; then
    die "$env_file not found"
  fi

  log "INFO" "Encrypting $env_file → $enc_file"

  # Copy plaintext to .env.enc first, then encrypt in-place.
  # This way sops matches the .env.enc path against .sops.yaml rules.
  cp "$env_file" "$enc_file"
  sops --encrypt --in-place --input-type dotenv --output-type dotenv "$enc_file"

  log "OK" "Encrypted $service secrets"
}

case "$SCOPE" in
  backend)         encrypt_env "backend" ;;
  feature-service) encrypt_env "feature-service" ;;
  all)
    encrypt_env "backend"
    encrypt_env "feature-service"
    ;;
  *) die "Usage: $0 [backend|feature-service|all]" ;;
esac

log "OK" "Done — encrypted files are safe to commit"
