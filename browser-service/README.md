# Browser Service — Cloud Anti-Detect Browser

> Python FastAPI service yang menjalankan sesi browser cloud dengan anti-fingerprint injection dan noVNC streaming.

## Architecture

```
User Request → FastAPI (:6100)
                  ↓
            SessionManager
                  ↓
    ┌─────────────┼──────────────┐
    ↓             ↓              ↓
  Xvfb      Chrome (real)    Stealth.js
  (display)  (Playwright)    (14 vectors)
    ↓             ↓
  x11vnc    ← captures display
    ↓
  websockify (WS bridge)
    ↓
  wss://browser.aivalid.id/ws/{port} → noVNC iframe (frontend)
```

## Anti-Detection (14 Vectors)

| # | Vector | Method |
|---|--------|--------|
| 1 | Navigator | Proxy platform, vendor, hardwareConcurrency, deviceMemory |
| 2 | WebDriver | Remove `navigator.webdriver` + CDP cleanup |
| 3 | Canvas | Noise on toDataURL, toBlob, getImageData |
| 4 | WebGL | Spoof UNMASKED_VENDOR/RENDERER (16 GPUs) |
| 5 | AudioContext | Frequency noise injection |
| 6 | ClientRects | Position/size noise |
| 7 | Screen | Resolution proxy matching profile |
| 8 | WebRTC | STUN block + Chromium args |
| 9 | Timezone | Intl.DateTimeFormat + getTimezoneOffset spoof |
| 10 | Plugins | Chrome PDF Plugin, Native Client |
| 11 | Permissions | Realistic query responses |
| 12 | Connection | 4g/wifi, deterministic per profile |
| 13 | Fonts | Per-platform font lists (Win/Mac/Linux) |
| 14 | TLS/JA3 | Chrome real binary (not Chromium) |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/start` | JWT | Start browser session |
| POST | `/api/sessions/{id}/stop` | JWT | Stop browser session |
| GET | `/api/sessions/{id}/status` | JWT | Get session status + VNC URL |
| GET | `/api/sessions/{id}/screenshot` | JWT | Capture screenshot |
| GET | `/health` | None | Health check |
| WS | `/ws/{port}` | None | WebSocket proxy to VNC |

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, lifespan (watchdog start/stop) |
| `routes.py` | HTTP endpoint handlers |
| `session_manager.py` | Full lifecycle: Xvfb → Chrome → x11vnc → websockify |
| `stealth.py` | 14-vector anti-fingerprint JS injection |
| `fingerprint.py` | Deterministic fingerprint generation (mulberry32 PRNG) |
| `ua_database.py` | 50+ User-Agent entries, 16 GPU renderers |
| `geo.py` | Proxy IP geo-lookup via ip-api.com (LRU cached) |
| `auth.py` | JWT validation middleware |
| `config.py` | Pydantic Settings (env vars) |
| `models.py` | Pydantic request/response models |

## Setup

### System Dependencies (Linux)

```bash
sudo apt install xvfb x11vnc websockify
```

### Python Environment

```bash
cd browser-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Chrome Real (Optional — improves TLS fingerprint)

```bash
# Download Chrome for Testing:
curl -L -o /tmp/chrome.zip "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.85/linux64/chrome-linux64.zip"
unzip /tmp/chrome.zip -d /opt/alephdraad/.cache/ms-playwright/chrome-real/
```

### Environment Variables

```bash
cp .env.example .env
# Edit .env with your values
```

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `6100` | API port |
| `JWT_SECRET` | - | Must match Go backend |
| `FEATURE_SERVICE_URL` | `http://127.0.0.1:5000` | Feature Service for billing |
| `FEATURE_SERVICE_TOKEN` | - | SERVICE_TOKEN for billing auth |
| `MAX_CONCURRENT_GLOBAL` | `50` | Max sessions (all users) |
| `MAX_CONCURRENT_PER_USER` | `2` | Max sessions per user |
| `VNC_PORT_RANGE_START` | `6200` | VNC port range start |
| `VNC_PORT_RANGE_END` | `6299` | VNC port range end |
| `BROWSER_PROFILES_DIR` | `/opt/.../profiles` | Profile data directory |
| `BILLING_INTERVAL_SECONDS` | `60` | Billing tick interval |
| `BROWSER_WS_DOMAIN` | `browser.aivalid.id` | Public WebSocket domain |

### Run

```bash
uvicorn main:app --host 0.0.0.0 --port 6100
```

## Deployment

Deployed as systemd service on VPS:

```bash
# Service unit: /etc/systemd/system/browser-service.service
sudo systemctl start browser-service
sudo systemctl status browser-service

# Logs:
sudo journalctl -u browser-service -f --no-pager

# Health check:
curl http://127.0.0.1:6100/health
```

## Integration

- **Feature Service** handles browser profiles (CRUD) and billing (wallet deduction)
- **Browser Service** handles session lifecycle and sends billing ticks to Feature Service
- **Frontend** (`/cloud-browser`) renders profile management and noVNC viewer

```
Frontend → Feature Service : profiles CRUD, pricing, session list
Frontend → Browser Service : session start/stop/status
Browser Service → Feature Service : billing ticks (POST /api/v1/browser/sessions/billing/tick)
```
