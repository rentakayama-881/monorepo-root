# Secret Management — sops + age

This project uses **[sops](https://github.com/mozilla/sops)** with the **[age](https://github.com/FiloSottile/age)** backend to encrypt secrets at rest in the repository.

## How it works

```
.env (plaintext, gitignored)
  ↓  ops/secrets-encrypt.sh
.env.enc (encrypted, committed to git)
  ↓  ops/secrets-decrypt.sh
.env (plaintext, gitignored)
```

- **age** uses asymmetric encryption: a public key encrypts, a private key decrypts.
- **sops** wraps age to handle structured file formats (dotenv, JSON, YAML).
- `.env.enc` files are safe to commit — they are encrypted and useless without the private key.
- `.env` files are **never committed** (gitignored).

## Prerequisites

### age (encryption tool)

```bash
# Install via Go
go install filippo.io/age/cmd/...@latest

# Or download binary
curl -LO https://github.com/FiloSottile/age/releases/latest/download/age-v1.3.1-linux-amd64.tar.gz
tar xf age-v1.3.1-linux-amd64.tar.gz
sudo mv age/age age/age-keygen /usr/local/bin/
rm -rf age age-v1.3.1-linux-amd64.tar.gz
```

### sops (secret operations)

```bash
# Download binary (v3.7.3 — supports age)
curl -LO https://github.com/mozilla/sops/releases/download/v3.7.3/sops-v3.7.3.linux.amd64
sudo mv sops-v3.7.3.linux.amd64 /usr/local/bin/sops
sudo chmod +x /usr/local/bin/sops
```

## Initial setup (first time only)

### 1. Generate your age key

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

This prints your **public key** (`age1…`). Keep the private key file safe.

### 2. Add your public key to `.sops.yaml`

Open `.sops.yaml` at the repository root and add your public key to the `age` field. Multiple keys are comma-separated:

```yaml
creation_rules:
  - path_regex: \.env\.enc$
    age: >-
      age1abc...,age1def...
```

### 3. Re-encrypt all secrets

After adding a new key, re-encrypt so that person can decrypt:

```bash
bash ops/secrets-encrypt.sh all
```

## Daily usage

### Decrypt secrets (after cloning or pulling)

```bash
bash ops/secrets-decrypt.sh all
# or for a specific service:
bash ops/secrets-decrypt.sh backend
bash ops/secrets-decrypt.sh feature-service
```

### Encrypt secrets (after editing .env)

```bash
bash ops/secrets-encrypt.sh all
# or for a specific service:
bash ops/secrets-encrypt.sh backend
bash ops/secrets-encrypt.sh feature-service
```

Then commit the `.env.enc` files.

## Adding a new developer

1. They generate an age key: `age-keygen -o ~/.config/sops/age/keys.txt`
2. They share their **public key** (`age1…`) — this is safe to share.
3. Add the public key to `.sops.yaml` (comma-separated with existing keys).
4. Re-encrypt all secrets: `bash ops/secrets-encrypt.sh all`
5. Commit the updated `.sops.yaml` and `.env.enc` files.

## Adding a new server / VPS

Same as adding a developer:

1. Generate an age key on the server.
2. Add its public key to `.sops.yaml`.
3. Re-encrypt and deploy the updated `.env.enc` files.
4. On the server, run `bash ops/secrets-decrypt.sh all` to restore `.env` files.

## Key rotation

If the age private key is compromised or you want to rotate keys:

1. Generate a new key: `age-keygen -o ~/.config/sops/age/keys.txt`
2. Replace the old public key in `.sops.yaml` with the new one.
3. Re-encrypt all secrets: `bash ops/secrets-encrypt.sh all`
4. Commit and deploy.
5. **Rotate all application secrets** (JWT_SECRET, DATABASE_URL passwords, API keys, etc.) — the old encrypted values may have been exposed.

## Emergency: key compromise

If you suspect the private key has been leaked:

1. **Immediately rotate all application secrets** (database passwords, JWT secrets, API keys).
2. Update the `.env` files with new secret values.
3. Generate a new age key.
4. Update `.sops.yaml` with the new public key (remove the compromised one).
5. Re-encrypt: `bash ops/secrets-encrypt.sh all`
6. Deploy the new secrets to all servers.
7. Audit git history — the old `.env.enc` files are in git history and can be decrypted with the compromised key.

## Deploy pipeline integration

In the deploy script (`ops/vps-sync-deploy.sh` or similar):

```bash
# On VPS after pulling latest code:
bash ops/secrets-decrypt.sh all
systemctl restart backend feature-service
```

The VPS must have:
- `sops` and `age` installed
- The age private key at `~/.config/sops/age/keys.txt`

## File reference

| File | Committed | Purpose |
|---|---|---|
| `.sops.yaml` | ✅ Yes | Encryption rules + public keys |
| `backend/.env` | ❌ No | Plaintext secrets (gitignored) |
| `backend/.env.enc` | ✅ Yes | Encrypted secrets |
| `backend/.env.example` | ✅ Yes | Template with placeholder values |
| `feature-service/.env` | ❌ No | Plaintext secrets (gitignored) |
| `feature-service/.env.enc` | ✅ Yes | Encrypted secrets |
| `feature-service/.env.example` | ✅ Yes | Template with placeholder values |
| `~/.config/sops/age/keys.txt` | ❌ Never | Private key — **never share or commit** |
| `ops/secrets-encrypt.sh` | ✅ Yes | Encryption helper script |
| `ops/secrets-decrypt.sh` | ✅ Yes | Decryption helper script |

## Troubleshooting

### "could not decrypt data key" on decrypt

Your age private key doesn't match any of the public keys in `.sops.yaml`. Ensure your key is listed there and secrets have been re-encrypted after adding it.

### "keys.txt not found"

Run: `mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt`

### .env.enc not being tracked by git

Check that `.gitignore` has the exclusion rule: `!**/.env.enc`
