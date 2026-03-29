# Follow-Up #5: Accessibility (WCAG AA) Deep-Dive

> Checklist lengkap untuk mencapai WCAG 2.1 Level AA compliance.
> Ini BUKAN nice-to-have — ini requirement legal di banyak jurisdiksi 
> dan standard minimum untuk website profesional.

---

## CURRENT STATE

Dari audit, AIValid sudah punya beberapa fondasi:
- ✅ Skip link ("Langsung ke konten utama")
- ✅ Focus-visible rings pada interactive elements
- ✅ aria-label pada beberapa komponen
- ✅ role="alert" pada error messages
- ✅ prefers-reduced-motion support
- ⚠️ Tidak semua images punya meaningful alt
- ⚠️ Color contrast belum diverifikasi systematically
- ⚠️ Keyboard navigation tidak complete di semua komponen
- ❌ Tidak ada accessibility testing terintegrasi

---

## CHECKLIST: PERCEIVABLE (Bisa Dilihat/Didengar)

### 1.1 Text Alternatives

```
□ Semua <img> punya alt attribute yang deskriptif
  - Decorative images: alt="" (empty, bukan tanpa alt)
  - Informative images: describe apa yang ditampilkan
  - Images of text: alt = teks yang ada di image
  
□ Icon buttons punya aria-label
  CONTOH:
  <button aria-label="Tutup modal">
    <X className="size-4" />
  </button>

□ SVG icons yang standalone punya title atau aria-label
  <svg role="img" aria-label="Status berhasil">...</svg>
  
□ Complex graphics (charts, diagrams) punya text alternative
```

### 1.2 Time-based Media

```
□ Video content punya captions (jika ada)
□ Audio content punya transcript (jika ada)
□ Auto-playing media bisa di-pause
```

### 1.3 Adaptable Content

```
□ Heading hierarchy logis (h1 → h2 → h3, no skip)
□ Lists menggunakan <ul>/<ol>/<dl> (bukan styled divs)
□ Tables menggunakan <th>, <caption>, scope attributes
□ Form fields terhubung ke <label> (htmlFor/id)
□ Landmarks: <main>, <nav>, <header>, <footer>, <aside>
□ Konten bisa dibaca tanpa CSS (meaningful HTML structure)
```

### 1.4 Distinguishable

```
□ Color contrast ratio:
  - Normal text (< 18px): minimum 4.5:1
  - Large text (≥ 18px bold atau ≥ 24px): minimum 3:1
  - UI components & graphical objects: minimum 3:1
  
□ Informasi TIDAK hanya disampaikan lewat warna
  - Status: warna + icon + teks
  BURUK:  <span className="text-green-500">Berhasil</span>
  BAIK:   <span className="text-success flex items-center gap-1">
            <CheckCircle className="size-4" /> Berhasil
          </span>

□ Text bisa di-zoom 200% tanpa loss of content/functionality
□ Text spacing bisa di-override tanpa loss of content
□ Content reflow di viewport 320px width (tanpa horizontal scroll)
```

### Contrast Check Commands

```bash
# Install contrast checker
npm install -D axe-core @axe-core/cli

# Run accessibility audit pada halaman
npx @axe-core/cli http://localhost:3000 --tags wcag2a,wcag2aa

# Atau install axe browser extension dan manual check
```

### Contrast Pairs to Verify

```
Background → Foreground:
- --background → --foreground              (body text)
- --card → --card-foreground               (card text)
- --primary → --primary-foreground         (button text)
- --destructive → --destructive-foreground (danger button)
- --muted → --muted-foreground             (subdued text)
- --background → --muted-foreground        (helper text on bg)

SEMUA pairs harus ≥ 4.5:1 untuk text, ≥ 3:1 untuk large text/UI
```

---

## CHECKLIST: OPERABLE (Bisa Dioperasikan)

### 2.1 Keyboard Accessible

```
□ SEMUA interactive elements bisa di-reach via Tab
□ Focus order mengikuti visual order (left→right, top→bottom)
□ No keyboard traps (kecuali modal yang intentional)
□ Custom components punya keyboard support:

  COMPONENT          KEYS
  Button             Enter, Space → activate
  Link               Enter → navigate
  Checkbox           Space → toggle
  Radio              Arrow keys → navigate, Space → select
  Select/Dropdown    Arrow keys → navigate, Enter → select, Escape → close
  Modal              Escape → close, Tab → cycle focus inside
  Tabs               Arrow keys → navigate tabs, Enter → activate
  Accordion          Enter/Space → toggle, Arrow keys → navigate
  Menu/Popover       Arrow keys → navigate, Escape → close
  Tooltip            Focus → show, Blur/Escape → hide
  Toast              Focus → pause auto-dismiss, Escape → dismiss

□ Focus visible: focus-visible:ring-2 (JANGAN hilangkan default focus styles)
□ Skip link di awal halaman: "Langsung ke konten utama" (sudah ada ✅)
```

### 2.2 Enough Time

```
□ Toast/notification auto-dismiss: minimum 4 detik (sudah 4000ms ✅)
□ Session timeout: warning sebelum logout
□ Animations bisa di-disable via prefers-reduced-motion (sudah ada ✅)
□ Auto-updating content (live data) bisa di-pause
```

### 2.3 Seizures & Physical Reactions

```
□ Tidak ada flashing content > 3 flashes per second
□ Animations yang cover > 25% viewport bisa di-disable
□ prefers-reduced-motion direspek (sudah ada ✅)
```

### 2.4 Navigable

```
□ Setiap halaman punya descriptive <title>
□ Focus order logis
□ Link purpose jelas dari text-nya (bukan "klik di sini")
  BURUK: <a href="/cases">klik di sini</a>
  BAIK:  <a href="/cases">Lihat semua case validasi</a>
□ Multiple navigation methods: menu, search, breadcrumb, sitemap
□ Headings dan labels deskriptif
□ Focus visible di semua interactive elements
```

---

## CHECKLIST: UNDERSTANDABLE (Bisa Dipahami)

### 3.1 Readable

```
□ Page language set: <html lang="id"> (Indonesian)
□ Parts in different language marked: <span lang="en">Submit</span>
  (Catatan: AIValid full Indonesian, tapi technical terms boleh English)
□ Abbreviations explained on first use
□ Reading level appropriate (target: SMA/kuliah)
```

### 3.2 Predictable

```
□ Navigation konsisten di semua halaman
□ Components yang sama terlihat dan berperilaku sama di mana-mana
□ Perubahan context tidak terjadi secara unexpected
  - Focus change: hanya dari user action
  - Form submit: hanya dari explicit button click
  - Page navigation: hanya dari explicit link/button click
```

### 3.3 Input Assistance

```
□ Error identification: error messages describe APA yang salah
□ Labels/instructions ada di semua form fields
□ Error suggestion: suggest BAGAIMANA memperbaiki
  BURUK: "Email tidak valid"
  BAIK: "Format email tidak valid. Contoh: nama@email.com"
□ Error prevention untuk important actions:
  - Confirmation dialog sebelum delete
  - Review step sebelum financial transaction
  - Ability to undo/cancel
```

---

## CHECKLIST: ROBUST (Bisa Diproses Mesin)

### 4.1 Compatible

```
□ Valid HTML (no duplicate IDs, proper nesting)
□ ARIA roles, states, properties yang benar
□ Custom components punya proper ARIA:
  - role (button, dialog, tab, tabpanel, etc.)
  - aria-expanded (collapsible elements)
  - aria-selected (tabs, options)
  - aria-checked (checkbox, radio, switch)
  - aria-disabled (disabled elements)
  - aria-label/aria-labelledby (when no visible label)
  - aria-describedby (additional descriptions)
  - aria-live (dynamic content updates)
  - aria-busy (loading states)
□ Status messages announced to screen readers:
  - Toast: role="alert" atau aria-live="polite"
  - Form errors: role="alert"  
  - Loading: aria-busy="true"
  - Content updates: aria-live="polite"
```

---

## TESTING TOOLS

### Automated Testing

```bash
# 1. axe-core (paling populer)
npm install -D @axe-core/react
# Tambahkan ke development mode:
# if (process.env.NODE_ENV === 'development') {
#   import('@axe-core/react').then(axe => axe.default(React, ReactDOM, 1000));
# }

# 2. eslint-plugin-jsx-a11y (lint-time checking)
npm install -D eslint-plugin-jsx-a11y
# Tambah ke eslint config

# 3. Storybook a11y addon (visual di Storybook)
# Sudah include di Storybook setup (Follow-Up #4)

# 4. Playwright accessibility testing
# Tambahkan ke e2e tests:
# await expect(page).toHaveNoViolations(); (custom matcher with axe)
```

### Manual Testing Checklist

```
□ Keyboard-only navigation: bisa complete semua tasks tanpa mouse
□ Screen reader testing (minimal): 
  - macOS: VoiceOver (Cmd+F5)
  - Windows: NVDA (free) atau Narrator
  - Navigasi heading, links, landmarks
□ Zoom 200%: semua konten tetap bisa diakses
□ High contrast mode: konten tetap visible
□ Mobile VoiceOver/TalkBack: gesture navigation works
```

---

## ARIA PATTERNS PER KOMPONEN

### Quick Reference

```
BUTTON:
<button type="button" aria-label="Close" aria-pressed="false">

LINK AS BUTTON:
<a href="/page" role="link">  (default, tidak perlu role)

MODAL:
<div role="dialog" aria-modal="true" aria-labelledby="title-id">
  <h2 id="title-id">Title</h2>
</div>

TABS:
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">
  <button role="tab" aria-selected="false" aria-controls="panel-2">
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">

ACCORDION:
<h3>
  <button aria-expanded="true" aria-controls="content-1">
</h3>
<div id="content-1" role="region" aria-labelledby="header-1">

COMBOBOX/SEARCHABLE SELECT:
<input role="combobox" aria-expanded="true" aria-controls="listbox-1" 
       aria-activedescendant="option-3">
<ul role="listbox" id="listbox-1">
  <li role="option" id="option-1" aria-selected="false">
  <li role="option" id="option-3" aria-selected="true">
</ul>

TOOLTIP:
<button aria-describedby="tooltip-1">
<div role="tooltip" id="tooltip-1">

ALERT/TOAST:
<div role="alert" aria-live="assertive">  (urgent)
<div role="status" aria-live="polite">     (non-urgent)

PROGRESS:
<div role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100"
     aria-label="Upload progress">

SWITCH:
<button role="switch" aria-checked="true" aria-label="Enable notifications">

BREADCRUMB:
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li aria-current="page">Current</li>
  </ol>
</nav>
```

---

## IMPLEMENTASI PRIORITY

```
Phase 1 (Critical):
□ Verify all color contrast ratios (WCAG AA)
□ Add aria-label to all icon-only buttons
□ Ensure all form fields have associated labels
□ Add proper heading hierarchy to all pages
□ Keyboard navigation for Modal, Select, Toast

Phase 2 (Important):
□ Add eslint-plugin-jsx-a11y to lint pipeline
□ Add @axe-core/react to development mode
□ Keyboard navigation for new components (Tabs, Accordion, Popover)
□ Screen reader testing for main user flows
□ Error message improvements (specific + actionable)

Phase 3 (Polish):
□ Storybook a11y addon integration
□ Playwright a11y tests for key pages
□ Live region announcements for dynamic content
□ Skip link improvements
□ Focus management for route changes (announce new page)
```

---

*Accessibility bukan fitur yang di-"tambahkan." Ini harus menjadi bagian dari 
setiap decision saat develop komponen dan halaman baru.*
