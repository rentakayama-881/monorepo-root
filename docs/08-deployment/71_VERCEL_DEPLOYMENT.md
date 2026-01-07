# ▲ Vercel Deployment

> Cara deploy Frontend Next.js ke Vercel.

---

## 🎯 Kenapa Vercel?

- **Next.js native** - Dibuat oleh tim yang sama
- **Edge Network** - CDN global untuk performa maksimal
- **Preview deployments** - Setiap PR mendapat URL preview
- **Zero config** - Deteksi Next.js otomatis
- **Free tier generous** - Cukup untuk MVP/startup

---

## 📋 Prerequisites

1. GitHub repository
2. Akun Vercel (free tier OK)
3. Domain (opsional, Vercel sediakan subdomain gratis)

---

## 🚀 Setup Deployment

### Step 1: Connect Repository

1. Login ke [vercel.com](https://vercel.com)
2. Klik **"Add New Project"**
3. Import repository dari GitHub
4. Pilih monorepo root

### Step 2: Configure Project

```
Root Directory: frontend
Framework Preset: Next.js (auto-detected)
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### Step 3: Environment Variables

Tambahkan di Vercel Dashboard → Settings → Environment Variables:

```bash
# API URLs
NEXT_PUBLIC_API_BASE_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature.alephdraad.fun

# Optional
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Catatan**: Prefix `NEXT_PUBLIC_` wajib untuk variabel yang diakses di browser.

### Step 4: Deploy

Klik **"Deploy"** dan tunggu build selesai (~2-5 menit).

---

## 🔄 Auto Deployment

Setelah setup:

| Branch | Deployment |
|--------|------------|
| `main` | Production (alephdraad.fun) |
| PR branches | Preview (random-url.vercel.app) |

---

## 🌐 Custom Domain

### Setup Domain

1. Go to Settings → Domains
2. Add domain: `alephdraad.fun`
3. Configure DNS di Cloudflare:

```
Type: CNAME
Name: @
Target: cname.vercel-dns.com
Proxy: OFF (DNS only)
```

Atau untuk subdomain:

```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
```

### SSL Certificate

Vercel menyediakan SSL gratis dan otomatis.

---

## ⚙️ Build Configuration

### vercel.json (opsional)

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["sin1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

### next.config.mjs

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['api.alephdraad.fun', 'avatars.githubusercontent.com'],
  },
  async rewrites() {
    return [
      // Optional: Proxy API calls through Vercel
      // {
      //   source: '/api/v1/:path*',
      //   destination: 'https://api.alephdraad.fun/api/:path*'
      // }
    ]
  }
}

export default nextConfig
```

---

## 🔍 Monitoring

### Vercel Analytics

1. Enable di Dashboard → Analytics
2. Tambahkan ke `app/layout.js`:

```jsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Speed Insights

```jsx
import { SpeedInsights } from '@vercel/speed-insights/next'

// Tambahkan di layout
<SpeedInsights />
```

---

## 🔧 Troubleshooting

### Build Failed

```bash
# Check build logs di Vercel Dashboard
# Common issues:

1. Missing environment variables
   → Tambahkan di Settings → Environment Variables

2. TypeScript errors
   → Fix errors atau set "strict": false di tsconfig.json

3. ESLint errors
   → Fix atau tambahkan "eslint.ignoreDuringBuilds": true di next.config

4. Out of memory
   → Upgrade plan atau optimize build
```

### 404 on Refresh

Next.js App Router biasanya handle ini otomatis. Jika pakai custom server, pastikan rewrites dikonfigurasi.

### CORS Errors

Backend harus allow origin `https://alephdraad.fun`.

---

## 📊 Vercel Limits (Free Tier)

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Serverless Functions | 100 GB-hrs/month |
| Build Execution | 6000 min/month |
| Deployments | Unlimited |
| Preview Deployments | Unlimited |

---

## ▶️ Selanjutnya

- [72_VPS_DEPLOYMENT.md](./72_VPS_DEPLOYMENT.md) - Deploy Backend ke VPS
