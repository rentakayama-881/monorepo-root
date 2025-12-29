# Alephdraad Logo Assets

## 🎨 Logo Files

| File | Description | Use Case |
|------|-------------|----------|
| `logo-light.svg` | Full logo for light backgrounds | Main website, documents |
| `logo-dark.svg` | Full logo for dark backgrounds | Dark mode UI |
| `logo-icon-only.svg` | Icon without text (light) | App icons, small spaces |
| `logo-icon-only-dark.svg` | Icon without text (dark) | Dark mode app icons |
| `logo-horizontal.svg` | Logo with brand name (light) | Headers, navigation |
| `logo-horizontal-dark.svg` | Logo with brand name (dark) | Dark mode headers |
| `favicon.svg` | Optimized for favicon | Browser tabs |

## 📐 Mathematical Foundation

### Golden Ratio (φ = 1.618033988749...)

The logo uses Golden Ratio proportions for visual harmony:

```
φ = (1 + √5) / 2 ≈ 1.618033988749

Circle Radii:
├── R₁ = 140px (Outer ring)
├── R₂ = R₁/φ = 86.5px (Second ring)
├── R₃ = R₂/φ = 53.5px (Inner boundary)
└── R₄ = R₃/φ = 33px (Core element)
```

### Fibonacci Spiral

The spiral follows the Fibonacci sequence:
```
F(n) = F(n-1) + F(n-2)
Sequence: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144...
```

### Hexagonal Symmetry (6-fold)

```
θ = 2π/6 = 60°
Vertices: (r·cos(nθ + π/2), r·sin(nθ + π/2)) for n = 0,1,2,3,4,5
```

## 🎨 Color Palette

### Light Mode
| Element | Color | Hex |
|---------|-------|-----|
| Primary | Dark Gray | `#57606A` |
| Secondary | Medium Gray | `#8B949E` |
| Accent | Claude Orange | `#DA7756` |
| Background | Light Gray | `#F6F8FA` |

### Dark Mode
| Element | Color | Hex |
|---------|-------|-----|
| Primary | Medium Gray | `#8B949E` |
| Secondary | Light Gray | `#C9D1D9` |
| Accent | Claude Orange | `#DA7756` |
| Background | Dark | `#0D1117` |

## 💡 Symbolism

| Element | Meaning |
|---------|---------|
| 🔵 Outer Ring | Möbius-inspired continuity, trust in escrow |
| 🌀 Fibonacci Spiral | Organic community growth |
| ⬡ Hexagon | Stability, efficiency (honeycomb = optimal) |
| △▽ Dual Triangles | Balance between buyers & sellers |
| ∞ Infinity Symbol | Unlimited AI, pay-as-you-go |
| ● Three Nodes | 3 main services: Thread, Escrow, AI |

## 📏 Usage Guidelines

### Minimum Sizes
- Full logo: 120px width minimum
- Icon only: 32px minimum
- Favicon: 16px minimum

### Clear Space
Maintain clear space around logo equal to the height of the center circle.

### Don'ts
- ❌ Don't stretch or distort
- ❌ Don't rotate
- ❌ Don't change colors outside brand palette
- ❌ Don't add effects (shadows, outlines)
- ❌ Don't place on busy backgrounds

## 🔧 Technical Notes

- All logos are in SVG format for infinite scalability
- Gradients use `linearGradient` and `radialGradient` for smooth color transitions
- Dark mode includes glow filters for neon effect
- Fibonacci spiral uses arc commands for smooth curves

## 📦 Generating PNG Versions

To generate PNG versions at different resolutions:

```bash
# Using Inkscape (if installed)
inkscape logo-light.svg -w 512 -h 512 -o logo-light@2x.png
inkscape logo-dark.svg -w 512 -h 512 -o logo-dark@2x.png

# Or use online tools like:
# - https://svgtopng.com
# - https://cloudconvert.com/svg-to-png
```

---

*Logo designed using Golden Ratio principles for mathematical harmony.*
