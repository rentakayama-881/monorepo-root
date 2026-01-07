# 🖥️ VPS Deployment

> Cara deploy Backend Gin dan Feature Service ke VPS.

---

## 🎯 Overview

Backend Alephdraad di-deploy ke **VPS (Virtual Private Server)**, memberikan kontrol penuh atas infrastruktur.

**Keuntungan VPS**:
- Full control atas server
- Tidak ada vendor lock-in
- Lebih cost-effective untuk long-term
- Bisa custom konfigurasi sesuai kebutuhan

---

## 🔧 Prerequisites

- VPS dengan Ubuntu 22.04+ / Debian 12+
- Minimal 2GB RAM, 2 vCPU
- Domain dengan DNS pointing ke VPS IP
- SSL certificate (Let's Encrypt)

---

## 📦 Deploy Backend Gin (Go)

### Step 1: Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y git curl wget build-essential

# Install Go
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### Step 2: Clone & Build

```bash
# Clone repository
git clone https://github.com/your-username/alephdraad.git
cd alephdraad/backend

# Build binary
go mod download
go build -o backend-gin .
```

### Step 3: Configure Environment

```bash
# Create .env file
cp .env.example .env
nano .env

# Set production values
PORT=8080
GIN_MODE=release
DATABASE_URL=postgres://...
JWT_SECRET=...
# etc.
```

### Step 4: Setup Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/backend-gin.service
```

```ini
[Unit]
Description=Alephdraad Backend Gin
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/deploy/alephdraad/backend
ExecStart=/home/deploy/alephdraad/backend/backend-gin
Restart=always
RestartSec=5
EnvironmentFile=/home/deploy/alephdraad/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable backend-gin
sudo systemctl start backend-gin

# Check status
sudo systemctl status backend-gin
```

---

## 📦 Deploy Feature Service (ASP.NET Core)

### Step 1: Install .NET Runtime

```bash
# Add Microsoft package repository
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb

# Install .NET Runtime
sudo apt update
sudo apt install -y aspnetcore-runtime-8.0
```

### Step 2: Build & Publish

```bash
cd /home/deploy/alephdraad/feature-service

# Publish for production
dotnet publish src/FeatureService.Api -c Release -o /var/www/feature-service
```

### Step 3: Setup Systemd Service

```bash
sudo nano /etc/systemd/system/feature-service.service
```

```ini
[Unit]
Description=Alephdraad Feature Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/feature-service
ExecStart=/usr/bin/dotnet /var/www/feature-service/FeatureService.Api.dll
Restart=always
RestartSec=5
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://localhost:5000
EnvironmentFile=/var/www/feature-service/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable feature-service
sudo systemctl start feature-service
```

---

## 🔒 Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt install -y nginx
```

### Backend Gin Config

```bash
sudo nano /etc/nginx/sites-available/api.alephdraad.fun
```

```nginx
server {
    listen 80;
    server_name api.alephdraad.fun;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Feature Service Config

```bash
sudo nano /etc/nginx/sites-available/feature.alephdraad.fun
```

```nginx
server {
    listen 80;
    server_name feature.alephdraad.fun;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Sites

```bash
sudo ln -s /etc/nginx/sites-available/api.alephdraad.fun /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/feature.alephdraad.fun /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 SSL dengan Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate SSL certificates
sudo certbot --nginx -d api.alephdraad.fun
sudo certbot --nginx -d feature.alephdraad.fun

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

---

## 🔄 Deployment Script

Buat script untuk update deployment:

```bash
nano /home/deploy/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "=== Pulling latest code ==="
cd /home/deploy/alephdraad
git pull origin main

echo "=== Building Backend Gin ==="
cd backend
go build -o backend-gin .
sudo systemctl restart backend-gin

echo "=== Building Feature Service ==="
cd ../feature-service
dotnet publish src/FeatureService.Api -c Release -o /var/www/feature-service
sudo systemctl restart feature-service

echo "=== Deployment complete ==="
```

```bash
chmod +x /home/deploy/deploy.sh
```

---

## 📊 Monitoring

### View Logs

```bash
# Backend Gin logs
sudo journalctl -u backend-gin -f

# Feature Service logs
sudo journalctl -u feature-service -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Checks

```bash
# Check services
curl https://api.alephdraad.fun/api/health
curl https://feature.alephdraad.fun/api/v1/health

# Check service status
sudo systemctl status backend-gin
sudo systemctl status feature-service
```

---

## 🔧 Firewall Setup

```bash
# Allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# Block direct access to backend ports
# (only allow via Nginx)
```

---

## ▶️ Selanjutnya

- [73_DATABASE_SETUP.md](./73_DATABASE_SETUP.md) - Database configuration
- [74_ENVIRONMENT_VARIABLES.md](./74_ENVIRONMENT_VARIABLES.md) - All env vars
