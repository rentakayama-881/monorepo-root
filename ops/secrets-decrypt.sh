#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ops/secrets-decrypt.sh — Decrypt .env.enc files with sops + age
#
# Usage:
#   bash ops/secrets-decrypt.sh [backend|feature-service|all]
#
# Reads the encrypted .env.enc for a service and writes
# the plaintext .env (permissions 600). If a .env already
# exists, it is backed up to .env.bak first.
#
# Requires the age private key at:
#   ~/.config/sops/age/keys.txt
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command sops
ensure_command age

SCOPE="${1:-all}"

decrypt_env() {
  local service="$1"
  local enc_file="$OPS_ROOT/$service/.env.enc"
  local env_file="$OPS_ROOT/$service/.env"

  if [[ ! -f "$enc_file" ]]; then
    die "$enc_file not found — run ops/secrets-encrypt.sh first"
  fi

  if [[ -f "$env_file" ]]; then
    log "WARN" "$env_file already exists — backing up to ${env_file}.bak"
    cp "$env_file" "${env_file}.bak"
  fi

  log "INFO" "Decrypting $enc_file → $env_file"
  sops --decrypt --input-type dotenv --output-type dotenv "$enc_file" > "$env_file"
  chmod 600 "$env_file"
  log "OK" "Decrypted $service secrets (permissions: 600)"
}

case "$SCOPE" in
  backend)         decrypt_env "backend" ;;
  feature-service) decrypt_env "feature-service" ;;
  all)
    decrypt_env "backend"
    decrypt_env "feature-service"
    ;;
  *) die "Usage: $0 [backend|feature-service|all]" ;;
esac

log "OK" "Done"
