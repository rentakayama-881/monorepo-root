# Follow-Up #9: Dynamic OG Image System

> Panduan untuk menghasilkan Open Graph images yang unik per halaman/konten,
> sehingga setiap share di social media terlihat profesional dan brand-consistent.

---

## CURRENT STATE

- ✅ Static OG image di `/app/opengraph-image.jsx` (1200×630)
- ✅ Twitter image di `/app/twitter-image.jsx` (1200×600)
- ⚠️ Semua halaman share OG image yang SAMA → missed opportunity

---

## GOAL

Setiap tipe halaman menghasilkan OG image yang unik dan contextual:

| Page Type | OG Image Content |
|-----------|-----------------|
| Homepage | Brand + tagline (sudah ada) |
| Case detail | Title + category + bounty + status |
| User profile | Avatar + username + stats |
| Market listing | Product name + price + seller |
| Category page | Category name + jumlah case |
| Static pages | Title + brand |

---

## IMPLEMENTATION: Next.js ImageResponse

Next.js App Router mendukung dynamic OG images via `ImageResponse`:

### Pattern: Per-Route OG Image

```jsx
// app/validation-cases/[id]/opengraph-image.jsx

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AIValid — Case Validasi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }) {
  const { id } = await params;
  
  // Fetch case data (edge-compatible fetch)
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/validation-cases/${id}`, {
    next: { revalidate: 3600 }, // Cache 1 jam
  });
  const data = await res.json();
  const caseData = data.data;

  // Load font
  const fontBold = await fetch(
    new URL("/public/fonts/ibm-plex/sans/IBMPlexSans-Bold.woff2", import.meta.url)
  ).then((r) => r.arrayBuffer());

  const fontRegular = await fetch(
    new URL("/public/fonts/ibm-plex/sans/IBMPlexSans-Regular.woff2", import.meta.url)
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          padding: "60px",
          fontFamily: "IBM Plex Sans",
        }}
      >
        {/* Top: Logo + Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Triangle logo mark */}
          <svg width="36" height="36" viewBox="0 0 512 512" fill="#4f46e5">
            <path d="M 239.7 68.1 Q 256.0 36.0 272.3 68.1 L 463.7 443.9 Q 480.0 476.0 444.0 476.0 L 68.0 476.0 Q 32.0 476.0 48.3 443.9 Z M 246.9 238.2 Q 256.0 216.0 265.1 238.2 L 338.9 417.8 Q 348.0 440.0 324.0 440.0 L 188.0 440.0 Q 164.0 440.0 173.1 417.8 Z" />
          </svg>
          <span style={{ color: "#ffffff", fontSize: "24px", fontWeight: 700 }}>
            AIValid
          </span>
        </div>

        {/* Middle: Case info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Category badge */}
          <div style={{
            display: "flex",
            marginBottom: "16px",
          }}>
            <span style={{
              backgroundColor: "#4f46e520",
              color: "#818cf8",
              fontSize: "16px",
              padding: "4px 16px",
              borderRadius: "6px",
              border: "1px solid #4f46e530",
            }}>
              {caseData?.category?.name || "Case Validasi"}
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            color: "#ffffff",
            fontSize: caseData?.title?.length > 60 ? "36px" : "48px",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            maxWidth: "900px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {caseData?.title || "Case Validasi"}
          </h1>
        </div>

        {/* Bottom: Meta info */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "32px",
          borderTop: "1px solid #ffffff15",
          paddingTop: "24px",
        }}>
          {/* Bounty */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#9ca3af", fontSize: "14px" }}>Bounty</span>
            <span style={{ color: "#10b981", fontSize: "20px", fontWeight: 600 }}>
              Rp {(caseData?.bounty_amount || 0).toLocaleString("id-ID")}
            </span>
          </div>

          {/* Status */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#9ca3af", fontSize: "14px" }}>Status</span>
            <span style={{ color: "#ffffff", fontSize: "20px", fontWeight: 600 }}>
              {caseData?.status || "Open"}
            </span>
          </div>

          {/* Author */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#9ca3af", fontSize: "14px" }}>Oleh</span>
            <span style={{ color: "#ffffff", fontSize: "20px", fontWeight: 600 }}>
              {caseData?.owner?.username || "Anonymous"}
            </span>
          </div>

          {/* Accent line */}
          <div style={{
            marginLeft: "auto",
            width: "60px",
            height: "4px",
            borderRadius: "2px",
            background: "linear-gradient(90deg, #4f46e5, #4f46e560)",
          }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "IBM Plex Sans", data: fontRegular, weight: 400 },
        { name: "IBM Plex Sans", data: fontBold, weight: 700 },
      ],
    }
  );
}
```

---

## OG IMAGE TEMPLATES

### Template 1: Default (untuk static pages)

```
┌─────────────────────────────────────────────┐
│                                             │
│  [Logo] AIValid                             │
│                                             │
│                                             │
│  Page Title                                 │
│  (large, white, bold)                       │
│                                             │
│  Subtitle / description                     │
│  (medium, gray)                             │
│                                             │
│  ─────── accent line (primary gradient) ──  │
│                                             │
└─────────────────────────────────────────────┘

Background: #0a0a0a (dark)
Logo: indigo (#4f46e5)
Title: white
Subtitle: gray (#9ca3af)
```

### Template 2: Case Detail

```
┌─────────────────────────────────────────────┐
│                                             │
│  [Logo] AIValid          [Category Badge]   │
│                                             │
│                                             │
│  Case Title                                 │
│  (max 2 lines, auto-size)                   │
│                                             │
│                                             │
│  ── border-top ──────────────────────────── │
│  Bounty: Rp XX.XXX  │  Status  │  Author   │
│                                             │
└─────────────────────────────────────────────┘
```

### Template 3: User Profile

```
┌─────────────────────────────────────────────┐
│                                             │
│  [Logo] AIValid                             │
│                                             │
│          ┌──────┐                           │
│          │Avatar│                           │
│          │ 96px │                           │
│          └──────┘                           │
│       @username (+ badges)                  │
│                                             │
│  ── stats row ─────────────────────────── │
│  12 Cases  │  45 Validasi  │  98% Rate     │
│                                             │
└─────────────────────────────────────────────┘
```

### Template 4: Market Listing

```
┌─────────────────────────────────────────────┐
│                                             │
│  [Logo] AIValid — Marketplace               │
│                                             │
│                                             │
│  Product Title                              │
│  (large, white)                             │
│                                             │
│  Rp XX.XXX (large, green)                   │
│  oleh @seller                               │
│                                             │
│  ── accent ──────────────────────────────── │
│                                             │
└─────────────────────────────────────────────┘
```

---

## FILE STRUCTURE

```
app/
├── opengraph-image.jsx                    # Default (homepage)
├── twitter-image.jsx                      # Default twitter
├── validation-cases/
│   └── [id]/
│       └── opengraph-image.jsx            # Per-case OG
├── user/
│   └── [username]/
│       └── opengraph-image.jsx            # Per-user OG
├── market/
│   └── chatgpt/
│       └── opengraph-image.jsx            # Market OG
├── about-content/
│   └── opengraph-image.jsx               # Static page OG
└── ...other pages with custom OG
```

---

## DESIGN CONSISTENCY RULES

```
1. Background: SELALU #0a0a0a (dark) — high contrast, looks good on all platforms
2. Logo: SELALU top-left, 36px mark + 24px text
3. Primary accent: SELALU #4f46e5 (indigo)
4. Font: SELALU IBM Plex Sans (load WOFF2 in ImageResponse)
5. Size: SELALU 1200×630 (OG) dan 1200×600 (Twitter)
6. Max text length: Title max 2 lines, auto-size font
7. Brand gradient: SELALU primary → primary/40 (linear-gradient)
8. Spacing: padding 60px dari edge
9. Content hierarchy: logo → category/context → title → meta
```

---

## CACHING STRATEGY

```javascript
// Di setiap OG image handler:
export const revalidate = 3600; // Revalidate setiap 1 jam

// ATAU gunakan on-demand revalidation:
// Saat case di-update, revalidate OG image
// await revalidatePath(`/validation-cases/${id}/opengraph-image`);
```

---

## TESTING

```
1. Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
2. Twitter Card Validator: https://cards-dev.twitter.com/validator
3. LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
4. Open Graph Preview: https://www.opengraph.xyz/

Test setiap template:
□ Render correct di Facebook preview
□ Render correct di Twitter card
□ Render correct di LinkedIn
□ Render correct di WhatsApp/Telegram link preview
□ Text readable di small preview (mobile messenger)
□ Brand recognizable di thumbnail size
```

---

## PERFORMANCE NOTES

```
1. OG images di-generate di Edge Runtime (cepat, dekat user)
2. Font files harus accessible dari edge (public/ folder)
3. API calls dari edge harus fast (< 500ms)
4. Cache aggressively (revalidate: 3600)
5. Fallback: jika API call gagal, tampilkan default template
6. Image size: target < 100 KB per generated image
```

---

*Dynamic OG images = setiap share di social media adalah IKLAN GRATIS yang 
terlihat profesional. Investasi kecil, impact besar untuk brand awareness.*
