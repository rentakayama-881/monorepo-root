FROM python:3.13-slim-bookworm

# System dependencies for Xvfb + x11vnc + websockify
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb x11vnc websockify \
    libxrender1 libxext6 libfontconfig1 libfreetype6 \
    ca-certificates curl procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-bake Playwright Chromium into the image
RUN playwright install chromium && playwright install-deps

COPY . .

# Profile and screenshot storage (mount as volumes)
RUN mkdir -p /data/profiles /data/screenshots

ENV HOST=0.0.0.0
ENV PORT=6100
ENV BROWSER_PROFILES_DIR=/data/profiles
ENV SCREENSHOT_DIR=/data/screenshots

EXPOSE 6100
# VNC ports (x11vnc)
EXPOSE 6200-6299
# WebSocket ports (websockify)
EXPOSE 6300-6399

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:6100/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "6100", "--workers", "1"]
