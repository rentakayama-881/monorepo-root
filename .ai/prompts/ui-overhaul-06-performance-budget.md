# Follow-Up #6: Performance Budget

> Target performa, budget ukuran bundle, dan aturan animasi agar website 
> tetap cepat setelah redesign. Website lambat = website jelek, 
> tidak peduli seberapa cantik design-nya.

---

## LIGHTHOUSE TARGETS (Minimum Scores)

| Metric | Target | Current Estimate |
|--------|--------|-----------------|
| **Performance** | ≥ 90 | ~85 (perlu verifikasi) |
| **Accessibility** | ≥ 95 | ~80 (perlu improvement) |
| **Best Practices** | ≥ 95 | ~90 |
| **SEO** | ≥ 95 | ~90 |

### Core Web Vitals Targets

| Metric | Good | Needs Improvement | Target |
|--------|------|-------------------|--------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | **≤ 2.0s** |
| **FID/INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | **≤ 150ms** |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | **≤ 0.05** |
| **FCP** (First Contentful Paint) | ≤ 1.8s | ≤ 3.0s | **≤ 1.5s** |
| **TTFB** (Time to First Byte) | ≤ 800ms | ≤ 1800ms | **≤ 500ms** |

---

## BUNDLE SIZE BUDGET

### Per-Page JavaScript Budget

| Page Type | Max JS (gzipped) | Reason |
|-----------|------------------|--------|
| Homepage | ≤ 120 KB | Marketing page, harus cepat |
| Auth pages (login/register) | ≤ 80 KB | Simple forms |
| List pages (cases, market) | ≤ 150 KB | Data fetching + rendering |
| Detail pages | ≤ 150 KB | Markdown rendering adds weight |
| Account/dashboard | ≤ 200 KB | Multiple features |
| Admin pages | ≤ 250 KB | Complex tables + charts OK |

### Shared Chunk Budget

| Chunk | Max Size (gzipped) | Contents |
|-------|-------------------|----------|
| Framework (React + Next.js) | ≤ 90 KB | Bawaan, tidak bisa dikontrol |
| UI Components | ≤ 30 KB | Button, Card, Input, dll |
| Utilities (lib/) | ≤ 15 KB | cn, format, auth, logger |
| Icons (lucide-react) | ≤ 20 KB | Tree-shaken per page |
| CSS | ≤ 50 KB | Tailwind purged |

### Monitoring Commands

```bash
# Analyze bundle
cd frontend

# Next.js built-in analyzer
ANALYZE=true npm run build

# Atau install bundle analyzer
npm install -D @next/bundle-analyzer

# next.config.mjs:
# import withBundleAnalyzer from '@next/bundle-analyzer';
# const config = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })({
#   ...nextConfig
# });
```

---

## CSS PERFORMANCE

### Rules

```
1. Tailwind v4 purging: otomatis, tapi PASTIKAN tidak import unused CSS
2. Animasi berat (@keyframes) lazy-load jika hanya dipakai di 1 halaman
3. Tidak boleh ada CSS-in-JS runtime (styled-components, emotion)
4. Font loading:
   - Preload: Regular (400) + SemiBold (600) — sudah dilakukan ✅
   - font-display: swap — sudah dilakukan ✅
   - Tidak load font weight yang tidak dipakai
5. Max total CSS: ≤ 50 KB gzipped
```

### Critical CSS

```
Next.js App Router handles ini otomatis:
- CSS untuk above-the-fold di-inline ke HTML
- CSS lainnya lazy-loaded
- TIDAK perlu manual critical CSS extraction
```

---

## IMAGE PERFORMANCE

### Rules

```
1. SEMUA images menggunakan next/image (otomatis optimization)
2. Format priority: WebP → AVIF (Next.js handles otomatis)
3. Lazy loading: default untuk images below fold
4. Priority loading: hero image, logo, above-fold images → priority={true}
5. Aspect ratio: SELALU set width + height (prevent CLS)
6. Max image sizes:
   - Hero banner: ≤ 200 KB
   - Card thumbnail: ≤ 50 KB
   - Avatar: ≤ 20 KB
   - Icon/logo: SVG (< 5 KB)
7. Responsive images: sizes prop sesuai layout
   <Image sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
```

---

## ANIMATION PERFORMANCE BUDGET

### Rules

```
1. HANYA animate properties yang GPU-accelerated:
   ✅ transform (translate, scale, rotate)
   ✅ opacity
   ✅ filter (blur, brightness)
   ❌ width, height (causes layout recalculation)
   ❌ top, left, right, bottom (causes layout recalculation)
   ❌ padding, margin (causes layout recalculation)
   ❌ box-shadow (expensive paint — gunakan pseudo-element trick)

2. will-change: HANYA pada elements yang PASTI akan animate
   - Jangan taruh will-change di semua elements
   - Remove will-change setelah animasi selesai (atau gunakan animation events)
   - Max 5 elements dengan will-change aktif bersamaan

3. Animation frame budget:
   - Target: 60fps (16.67ms per frame)
   - Max 10 animasi bersamaan di viewport
   - Stagger animations: max 6 items (300ms total stagger)
   - Pause animasi di luar viewport (IntersectionObserver)

4. prefers-reduced-motion:
   - SUDAH dihandle di globals.css ✅
   - Semua animasi HARUS dihormati setting ini
   - Reduced motion = instant state change (no transition, tapi masih functional)
```

### Shadow Performance Trick

```css
/* JANGAN animate box-shadow langsung (expensive): */
.card:hover {
  box-shadow: 0 10px 30px rgba(0,0,0,0.1); /* ❌ causes repaint */
}

/* GUNAKAN pseudo-element + opacity (GPU accelerated): */
.card {
  position: relative;
}
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  opacity: 0;
  transition: opacity 200ms ease-out; /* ✅ GPU accelerated */
}
.card:hover::after {
  opacity: 1;
}
```

---

## FONT PERFORMANCE

### Current Status ✅ Good

```
- Self-hosted WOFF2 (optimal format)
- font-display: swap (text visible immediately)
- Preload critical weights (400, 600)
- 4 weights per family (400, 500, 600, 700)
```

### Optimization Opportunities

```
1. PERTIMBANGKAN subsetting fonts (hanya karakter Latin + Indonesian)
   Ini bisa reduce font size 50-70%
   Tool: glyphhanger atau fonttools
   
2. Jika 500 (Medium) weight jarang dipakai, pertimbangkan drop
   400 → 600 sudah cukup contrast untuk hierarchy

3. Variable fonts: BISA replace 4 files dengan 1 file
   IBM Plex Sans Variable = ~60 KB vs 4 static = ~100 KB
   TAPI: hanya jika semua 4 weights benar-benar dipakai
```

---

## THIRD-PARTY PERFORMANCE

### Rules

```
1. AUDIT semua third-party scripts:
   - Sentry: ≤ 30 KB gzipped, lazy load setelah page interactive
   - Analytics: defer/async loading
   
2. Tidak boleh tambah third-party script baru tanpa:
   - Justifikasi fitur
   - Size impact assessment
   - Loading strategy (async/defer/lazy)
   
3. Third-party embed (jika ada):
   - YouTube: lite-youtube-embed (< 1 KB vs 800 KB iframe)
   - Maps: static image + link, bukan embed
   - Social: bukan embed widget, render data dari API
```

---

## MONITORING & TESTING

### Pre-Deploy Checks

```bash
# 1. Lighthouse CI (tambahkan ke CI/CD)
npm install -D @lhci/cli

# lighthouserc.js:
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/login', 'http://localhost:3000/validation-cases'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
      },
    },
  },
};

# 2. Bundle size check
npm run build 2>&1 | grep "First Load JS"
# Verify against budgets above

# 3. Manual Lighthouse
# Chrome DevTools → Lighthouse → Run audit
```

### Runtime Monitoring

```
1. Sentry Performance: monitor real user metrics (sudah setup ✅)
2. Web Vitals reporting: gunakan next/web-vitals atau web-vitals library
3. Set alerts untuk regressions:
   - LCP > 3s → alert
   - CLS > 0.1 → alert  
   - INP > 300ms → alert
```

---

## PERFORMANCE ANTI-PATTERNS

```
❌ Import seluruh icon library (import * from 'lucide-react')
   ✅ Import individual: import { ArrowRight } from 'lucide-react'

❌ Load semua komponen di layout (bloats semua halaman)
   ✅ Dynamic import untuk heavy components: dynamic(() => import(...), { ssr: false })

❌ Inline large data di page component (bloats HTML)
   ✅ Fetch data di server component atau via API

❌ CSS transitions di semua elements (transition-all pada *)
   ✅ Transition hanya di interactive elements yang butuh

❌ Multiple re-renders dari unnecessary state updates
   ✅ memo(), useMemo(), useCallback() di tempat yang tepat

❌ Fetch waterfall (component A fetch → render → component B fetch)
   ✅ Parallel fetch di server component atau Promise.all()

❌ Unoptimized images (<img src="large.png">)
   ✅ <Image> dari next/image dengan proper sizes
```

---

*Performa adalah fitur. Website dengan Lighthouse 90+ menunjukkan engineering maturity
yang setara dengan perusahaan tier-1.*
