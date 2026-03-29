# Follow-Up #1: Detailed Component Specs

> Spesifikasi lengkap untuk 10 komponen baru + standardisasi komponen existing.
> Setiap komponen HARUS mengikuti patterns yang sudah ada di codebase.

---

## EXISTING PATTERN REFERENCE (WAJIB DIIKUTI)

Sebelum membuat komponen baru, pahami pattern yang SUDAH ada:

```javascript
// 1. UTILITIES:
import { cn } from "@/lib/utils";              // clsx + tailwind-merge
import { cva } from "class-variance-authority"; // variant system

// 2. EXPORT PATTERN (sesuaikan dengan kompleksitas):
// Simple component → default export + memo()
export default memo(function ComponentName({ ...props }) { });

// Compound component → default + named exports, semua memo()
export const SubComponent = memo(function SubComponent({ ...props }) { });
export default memo(function MainComponent({ ...props }) { });

// Variant config → named export terpisah
export { componentVariants };

// 3. CLASSNAME MERGING (selalu terima + merge className prop):
className={cn(variants({ variant, size }), className)}

// 4. SIZE SYSTEM: "sm" | "md" | "lg" (md = default)
// 5. VARIANT SYSTEM: CVA dengan defaultVariants
// 6. ACCESSIBILITY: aria-* attributes, role, keyboard support
// 7. ANIMATION: transition-all duration-200 ease-out
// 8. COLORS: CSS variables only (text-foreground, bg-primary, dll)
```

---

## KOMPONEN #1: Tabs

### Deskripsi
Navigasi horizontal untuk switching konten dalam satu halaman. Underline style (bukan button group).

### Props Interface

```jsx
// === TabsRoot ===
Tabs({
  defaultValue,          // string — tab aktif awal (uncontrolled)
  value,                 // string — tab aktif (controlled)
  onChange,              // (value: string) => void
  children,             // ReactNode (TabsList + TabsContent)
  className = "",       // string
})

// === TabsList ===
TabsList({
  children,             // ReactNode (kumpulan TabsTrigger)
  className = "",       // string
})

// === TabsTrigger ===
TabsTrigger({
  value,                // string — identifier unik untuk tab ini (WAJIB)
  children,             // ReactNode — label tab
  disabled = false,     // boolean
  icon,                 // ReactNode — optional icon di kiri label
  badge,                // string | number — optional badge count di kanan label
  className = "",       // string
})

// === TabsContent ===
TabsContent({
  value,                // string — harus match dengan TabsTrigger value
  children,             // ReactNode — konten tab
  className = "",       // string
  forceMount = false,   // boolean — tetap mount walau tidak aktif (untuk form state preservation)
})
```

### Styling

```css
/* TabsList — container */
"flex border-b border-border gap-0"

/* TabsTrigger — inactive */
"relative px-4 py-2.5 text-sm font-medium text-muted-foreground 
 transition-colors duration-200 hover:text-foreground
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/* TabsTrigger — active (pseudo-element underline) */
"text-foreground"
/* + ::after pseudo-element: */
"after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 
 after:bg-primary after:transition-all after:duration-200"

/* TabsTrigger — disabled */
"opacity-50 pointer-events-none"

/* TabsContent */
"pt-6 focus-visible:outline-none animate-fade-in"
/* hidden jika value tidak match dan forceMount=false */
```

### Keyboard Support
```
Tab          → Focus ke TabsList, lalu ke content
ArrowLeft    → Tab sebelumnya (skip disabled)
ArrowRight   → Tab berikutnya (skip disabled)
Home         → Tab pertama
End          → Tab terakhir
Enter/Space  → Activate focused tab
```

### Accessibility
```
TabsList:    role="tablist"
TabsTrigger: role="tab", aria-selected, aria-controls, aria-disabled, tabIndex
TabsContent: role="tabpanel", aria-labelledby, tabIndex=0
```

### Usage Example
```jsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Ringkasan</TabsTrigger>
    <TabsTrigger value="submissions" badge={3}>Submission</TabsTrigger>
    <TabsTrigger value="history" icon={<Clock className="size-4" />}>Riwayat</TabsTrigger>
    <TabsTrigger value="settings" disabled>Pengaturan</TabsTrigger>
  </TabsList>
  
  <TabsContent value="overview">
    <p>Konten ringkasan...</p>
  </TabsContent>
  <TabsContent value="submissions">
    <p>Konten submission...</p>
  </TabsContent>
</Tabs>
```

---

## KOMPONEN #2: Tooltip

### Deskripsi
Popup kecil yang muncul saat hover/focus pada elemen. Untuk informasi tambahan singkat (1-2 kalimat max).

### Props Interface

```jsx
Tooltip({
  content,              // string | ReactNode — isi tooltip (WAJIB)
  children,             // ReactNode — trigger element (WAJIB)
  side = "top",         // "top" | "bottom" | "left" | "right"
  align = "center",     // "start" | "center" | "end"
  delayDuration = 300,  // number — ms sebelum muncul
  className = "",       // string — untuk tooltip content
})
```

### Styling

```css
/* Tooltip content */
"z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-1.5 
 text-xs text-popover-foreground shadow-md
 animate-fade-in [animation-duration:150ms]"

/* Arrow (CSS triangle) */
"absolute size-2 rotate-45 border bg-popover border-border"
/* Arrow position varies by side prop */
```

### Behavior
```
- Muncul setelah delayDuration ms hover
- Hilang langsung saat mouse leave (no exit delay)
- Muncul langsung pada focus (keyboard, no delay)
- Tidak muncul di touch devices (gunakan long-press atau skip)
- Auto-reposition jika keluar viewport (flip ke sisi berlawanan)
- TIDAK interactive (user tidak bisa hover ke tooltip itu sendiri)
```

### Accessibility
```
Trigger: aria-describedby={tooltipId}
Content: role="tooltip", id={tooltipId}
```

### Implementation Note
```
Gunakan floating-ui/react atau implementasi portal sendiri.
Jika tidak ingin tambah dependency, gunakan CSS-only approach:
- position: absolute relative to trigger wrapper
- Visibility toggle via state
- Viewport detection via getBoundingClientRect()
```

### Usage Example
```jsx
<Tooltip content="Salin ke clipboard" side="bottom">
  <button className="p-2 hover:bg-accent rounded-lg">
    <Copy className="size-4" />
  </button>
</Tooltip>

<Tooltip content="Harga dalam Rupiah (IDR), sudah termasuk biaya layanan 5%">
  <span className="text-muted-foreground cursor-help underline decoration-dotted">
    Rp 150.000
  </span>
</Tooltip>
```

---

## KOMPONEN #3: Popover

### Deskripsi
Panel floating yang muncul saat click. Untuk konten interaktif (menu, filter, form mini). Berbeda dari Tooltip: Popover = click-triggered & interactive.

### Props Interface

```jsx
// === PopoverRoot ===
Popover({
  open,                 // boolean (controlled) | undefined (uncontrolled)
  onOpenChange,         // (open: boolean) => void
  children,             // ReactNode (PopoverTrigger + PopoverContent)
})

// === PopoverTrigger ===
PopoverTrigger({
  children,             // ReactNode — element yang di-click untuk buka
  asChild = false,      // boolean — render children langsung tanpa wrapper
  className = "",       // string
})

// === PopoverContent ===
PopoverContent({
  children,             // ReactNode — isi popover
  side = "bottom",      // "top" | "bottom" | "left" | "right"
  align = "center",     // "start" | "center" | "end"
  sideOffset = 8,       // number — jarak dari trigger (px)
  className = "",       // string
  onInteractOutside,    // () => void — custom handler saat click di luar
})
```

### Styling

```css
/* PopoverContent */
"z-50 w-72 rounded-xl border border-border bg-popover p-4 
 text-popover-foreground shadow-md
 animate-in fade-in-0 zoom-in-95 duration-200
 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 
 data-[state=closed]:zoom-out-95"
```

### Behavior
```
- Buka: click trigger
- Tutup: click di luar, Escape key, atau programmatic
- Focus trapped di dalam popover saat terbuka
- Auto-reposition jika keluar viewport
- Hanya 1 popover terbuka sekaligus (buka yang baru = tutup yang lama)
```

### Accessibility
```
Trigger: aria-expanded, aria-haspopup="dialog", aria-controls
Content: role="dialog", aria-modal=false (bukan true karena bukan blocking)
Focus: pertama ke content, trap di dalam
```

### Usage Example
```jsx
<Popover>
  <PopoverTrigger>
    <Button variant="outline" size="sm">
      <Filter className="size-4" /> Filter
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-80">
    <h4 className="text-sm font-medium mb-3">Filter Case</h4>
    <div className="space-y-3">
      <Select label="Kategori" options={categories} />
      <Select label="Status" options={statuses} />
    </div>
    <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
      <Button variant="ghost" size="sm">Reset</Button>
      <Button size="sm">Terapkan</Button>
    </div>
  </PopoverContent>
</Popover>
```

---

## KOMPONEN #4: Breadcrumb

### Deskripsi
Trail navigasi hierarkis. Menunjukkan posisi user di dalam site structure.

### Props Interface

```jsx
Breadcrumb({
  items,                // Array<{ label: string, href?: string }> (WAJIB)
                        // Item terakhir = current page (tanpa href, non-clickable)
  separator = "/",      // string | ReactNode — pemisah antar item
  className = "",       // string
  maxItems = 0,         // number — jika > 0, collapse middle items ke "..."
})
```

### Styling

```css
/* Container */
"flex items-center gap-1.5 text-sm"

/* Item (link) */
"text-muted-foreground hover:text-foreground transition-colors duration-150"

/* Item (current/last) */
"text-foreground font-medium truncate max-w-[200px]"

/* Separator */
"text-muted-foreground/60 select-none mx-0.5"

/* Collapsed indicator */
"text-muted-foreground hover:text-foreground cursor-pointer px-1"
```

### Accessibility
```
Container: <nav aria-label="Breadcrumb">
List: <ol> (ordered list, semantic)
Items: <li> dengan <a> atau <span>
Current: aria-current="page" pada item terakhir
Separator: aria-hidden="true" (decorative)
```

### Usage Example
```jsx
// Simple
<Breadcrumb items={[
  { label: "Beranda", href: "/" },
  { label: "Case Validasi", href: "/validation-cases" },
  { label: "Validasi Kode Python" },
]} />

// With collapse (long paths)
<Breadcrumb maxItems={3} items={[
  { label: "Beranda", href: "/" },
  { label: "Akun", href: "/account" },
  { label: "Dompet", href: "/account/wallet" },
  { label: "Transaksi", href: "/account/wallet/transactions" },
  { label: "TXN-A1B2C3" },
]} />
// Renders: Beranda / ... / Transaksi / TXN-A1B2C3
```

---

## KOMPONEN #5: Accordion

### Deskripsi
Collapsible sections. Untuk FAQ, settings groups, atau konten yang bisa di-expand/collapse.

### Props Interface

```jsx
// === AccordionRoot ===
Accordion({
  type = "single",      // "single" | "multiple"
                         // single: hanya 1 item terbuka
                         // multiple: bisa banyak item terbuka bersamaan
  defaultValue,          // string (single) | string[] (multiple) — item terbuka awal
  value,                 // string | string[] — controlled
  onValueChange,         // (value) => void
  collapsible = true,    // boolean — single type: bisa tutup semua (default true)
  children,              // ReactNode (AccordionItem children)
  className = "",        // string
})

// === AccordionItem ===
AccordionItem({
  value,                 // string — identifier unik (WAJIB)
  children,              // ReactNode (AccordionTrigger + AccordionContent)
  disabled = false,      // boolean
  className = "",        // string
})

// === AccordionTrigger ===
AccordionTrigger({
  children,              // ReactNode — header text/content
  className = "",        // string
})

// === AccordionContent ===
AccordionContent({
  children,              // ReactNode — collapsible body
  className = "",        // string
})
```

### Styling

```css
/* AccordionItem */
"border-b border-border"

/* AccordionTrigger */
"flex w-full items-center justify-between py-4 text-sm font-medium 
 text-foreground transition-colors hover:text-foreground/80
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
 [&[data-state=open]>svg]:rotate-180"

/* Chevron icon (inside trigger, auto-appended) */
"size-4 text-muted-foreground transition-transform duration-200"

/* AccordionContent */
"overflow-hidden text-sm text-foreground/80
 data-[state=open]:animate-accordion-down 
 data-[state=closed]:animate-accordion-up"

/* AccordionContent inner (padding wrapper) */
"pb-4 pt-0"
```

### Animations (tambahkan ke animations.css)
```css
@keyframes accordion-down {
  from { height: 0; opacity: 0; }
  to { height: var(--accordion-content-height); opacity: 1; }
}

@keyframes accordion-up {
  from { height: var(--accordion-content-height); opacity: 1; }
  to { height: 0; opacity: 0; }
}
```

### Keyboard Support
```
Enter/Space  → Toggle item terbuka/tertutup
ArrowDown    → Focus item berikutnya
ArrowUp      → Focus item sebelumnya
Home         → Focus item pertama
End          → Focus item terakhir
```

### Usage Example
```jsx
<Accordion type="single" defaultValue="faq-1" collapsible>
  <AccordionItem value="faq-1">
    <AccordionTrigger>Apa itu AIValid?</AccordionTrigger>
    <AccordionContent>
      AIValid adalah platform validasi hasil kerja AI oleh ahli manusia...
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="faq-2">
    <AccordionTrigger>Bagaimana cara menjadi validator?</AccordionTrigger>
    <AccordionContent>
      Untuk menjadi validator, Anda perlu mendaftar dan memilih kategori keahlian...
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## KOMPONEN #6: Checkbox

### Deskripsi
Form control untuk boolean atau multi-select. Styled sesuai design system (bukan native browser).

### Props Interface

```jsx
Checkbox({
  checked = false,       // boolean | "indeterminate"
  onCheckedChange,       // (checked: boolean) => void
  disabled = false,      // boolean
  id,                    // string — untuk label association
  name,                  // string — form field name
  value,                 // string — form value
  label,                 // string | ReactNode — label text (optional, bisa pakai external <label>)
  description,           // string — helper text di bawah label
  error,                 // string — error message
  required = false,      // boolean
  className = "",        // string
})
```

### Styling

```css
/* Checkbox box */
"peer size-4 shrink-0 rounded-md border border-border bg-background
 transition-all duration-150
 hover:border-foreground/30
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
 disabled:cursor-not-allowed disabled:opacity-50
 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground
 data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"

/* Checkmark icon (SVG inside) */
"size-3 text-current" /* animated: scale from 0 to 1 */

/* Label */
"text-sm font-medium text-foreground cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50"

/* Description */
"text-xs text-muted-foreground mt-1"

/* Error */
"text-xs text-destructive mt-1"

/* Container layout */
"flex items-start gap-3"
```

### Accessibility
```
role="checkbox"
aria-checked={checked} (true | false | "mixed" for indeterminate)
aria-required, aria-invalid, aria-describedby
Linked to <label> via id
```

### Usage Example
```jsx
<Checkbox
  label="Saya setuju dengan syarat dan ketentuan"
  description="Dengan mencentang ini, Anda menyetujui kebijakan privasi kami"
  required
  error={errors.terms}
  onCheckedChange={(checked) => setAccepted(checked)}
/>

{/* Indeterminate (untuk select-all) */}
<Checkbox
  checked={selectedAll ? true : selectedSome ? "indeterminate" : false}
  onCheckedChange={handleSelectAll}
  label="Pilih semua"
/>
```

---

## KOMPONEN #7: Radio

### Deskripsi
Form control untuk single-select dari beberapa opsi. Grouped dalam RadioGroup.

### Props Interface

```jsx
// === RadioGroup ===
RadioGroup({
  value,                 // string — selected value (controlled)
  defaultValue,          // string — initial selected (uncontrolled)
  onValueChange,         // (value: string) => void
  name,                  // string — form field name
  disabled = false,      // boolean — disable semua items
  orientation = "vertical", // "vertical" | "horizontal"
  label,                 // string — group label
  error,                 // string — error message
  required = false,      // boolean
  children,              // ReactNode (RadioGroupItem children)
  className = "",        // string
})

// === RadioGroupItem ===
RadioGroupItem({
  value,                 // string — option value (WAJIB)
  label,                 // string | ReactNode — option label
  description,           // string — helper text
  disabled = false,      // boolean
  className = "",        // string
})
```

### Styling

```css
/* Radio circle */
"peer size-4 shrink-0 rounded-full border border-border bg-background
 transition-all duration-150
 hover:border-foreground/30
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
 disabled:cursor-not-allowed disabled:opacity-50
 data-[state=checked]:border-primary"

/* Radio dot (inner, saat checked) */
"size-2 rounded-full bg-primary 
 transition-transform duration-150 scale-0
 data-[state=checked]:scale-100"

/* Group — vertical */
"flex flex-col gap-3"

/* Group — horizontal */
"flex flex-wrap gap-6"

/* Item container */
"flex items-start gap-3"
```

### Keyboard Support
```
ArrowDown/ArrowRight → Select next option
ArrowUp/ArrowLeft    → Select previous option
Tab                  → Move focus out of group
```

### Usage Example
```jsx
<RadioGroup
  label="Metode pembayaran"
  value={method}
  onValueChange={setMethod}
  required
>
  <RadioGroupItem value="wallet" label="Dompet AIValid" description="Saldo: Rp 250.000" />
  <RadioGroupItem value="transfer" label="Transfer bank" description="BCA, Mandiri, BNI, BRI" />
  <RadioGroupItem value="crypto" label="Cryptocurrency" description="USDT (TRC20)" />
</RadioGroup>
```

---

## KOMPONEN #8: Switch / Toggle

### Deskripsi
Toggle on/off untuk settings. Lebih appropriate daripada checkbox untuk settings yang langsung berlaku (tanpa submit).

### Props Interface

```jsx
Switch({
  checked = false,       // boolean
  onCheckedChange,       // (checked: boolean) => void
  disabled = false,      // boolean
  id,                    // string
  name,                  // string
  label,                 // string | ReactNode
  description,           // string — helper di bawah label
  size = "md",           // "sm" | "md"
  className = "",        // string
})
```

### CVA Config

```javascript
const switchVariants = cva(
  "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
      },
      checked: {
        true: "bg-primary",
        false: "bg-muted-foreground/20",
      },
    },
    defaultVariants: { size: "md", checked: false },
  }
);

// Thumb (dot that slides)
const thumbVariants = cva(
  "pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
  {
    variants: {
      size: {
        sm: "size-4",
        md: "size-5",
      },
      checked: {
        true: "",   // translateX sesuai size
        false: "translate-x-0",
      },
    },
  }
);
// sm checked: translate-x-4
// md checked: translate-x-5
```

### Accessibility
```
role="switch"
aria-checked={checked}
aria-label (if no visible label)
```

### Usage Example
```jsx
<Switch
  label="Notifikasi email"
  description="Terima pemberitahuan saat case Anda mendapat validasi baru"
  checked={emailNotif}
  onCheckedChange={setEmailNotif}
/>

<Switch
  label="Mode gelap"
  size="sm"
  checked={isDark}
  onCheckedChange={toggleTheme}
/>
```

---

## KOMPONEN #9: Progress

### Deskripsi
Indikator kemajuan. Untuk upload, multi-step form, completion tracking.

### Props Interface

```jsx
Progress({
  value = 0,             // number — 0 to 100 (percentage)
  max = 100,             // number — maximum value
  size = "md",           // "sm" | "md" | "lg"
  variant = "default",   // "default" | "success" | "warning" | "danger"
  showLabel = false,     // boolean — tampilkan persentase text
  label,                 // string — custom label (override percentage)
  indeterminate = false, // boolean — animasi tanpa value (loading)
  className = "",        // string
})
```

### CVA Config

```javascript
const progressVariants = cva(
  "w-full overflow-hidden rounded-full bg-muted",
  {
    variants: {
      size: {
        sm: "h-1.5",
        md: "h-2.5",
        lg: "h-4",
      },
    },
    defaultVariants: { size: "md" },
  }
);

const indicatorVariants = cva(
  "h-full rounded-full transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-success",
        warning: "bg-warning",
        danger: "bg-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
```

### Behavior
```
- value di-clamp antara 0 dan max
- indeterminate = animasi sliding (CSS animation)
- Auto-variant: jika showLabel=true dan value >= 80 → success, value < 20 → default
  (HANYA jika variant tidak di-set explicitly)
```

### Accessibility
```
role="progressbar"
aria-valuenow={value}
aria-valuemin={0}
aria-valuemax={max}
aria-label={label || "Progress"}
```

### Usage Example
```jsx
// Simple
<Progress value={65} />

// With label
<Progress value={3} max={5} showLabel label="3 dari 5 langkah selesai" size="lg" />

// Upload progress
<Progress value={uploadPercent} variant={uploadPercent === 100 ? "success" : "default"} />

// Indeterminate loading
<Progress indeterminate />
```

---

## KOMPONEN #10: Separator

### Deskripsi
Visual divider. Menggantikan ad-hoc `border-b` dan `<hr>` yang tersebar di codebase.

### Props Interface

```jsx
Separator({
  orientation = "horizontal", // "horizontal" | "vertical"
  decorative = true,          // boolean — jika true, aria-hidden
  label,                      // string — text di tengah separator (optional)
  className = "",             // string
})
```

### Styling

```css
/* Horizontal */
"h-px w-full bg-border"

/* Vertical */
"w-px h-full bg-border"

/* With label */
"flex items-center gap-3"
/* Label text: */
"text-xs text-muted-foreground whitespace-nowrap"
/* Lines: */
"flex-1 h-px bg-border"
```

### Accessibility
```
Jika decorative=true: role="none", aria-hidden="true"
Jika decorative=false: role="separator", aria-orientation
```

### Usage Example
```jsx
// Simple divider
<Separator />

// Vertical in flex row
<div className="flex items-center gap-3 h-6">
  <span>Item 1</span>
  <Separator orientation="vertical" />
  <span>Item 2</span>
</div>

// With label (like "atau" divider in auth forms)
<Separator label="atau" />
```

---

## STANDARDISASI KOMPONEN EXISTING

### Perubahan yang Harus Dilakukan pada Komponen yang Sudah Ada

#### 1. Input.jsx — Tambahkan forwardRef
```jsx
// SEBELUM:
export default function Input({ ...props }) { }

// SESUDAH:
import { forwardRef } from "react";
const Input = forwardRef(function Input({ ...props }, ref) {
  // gunakan ref pada <input> element
});
export default memo(Input);
```

#### 2. Select.jsx — Tambahkan forwardRef + memo
```jsx
const Select = forwardRef(function Select({ ...props }, ref) { });
export default memo(Select);
```

#### 3. Textarea.jsx — Tambahkan forwardRef + memo
```jsx
const Textarea = forwardRef(function Textarea({ ...props }, ref) { });
export default memo(Textarea);
```

#### 4. Button.jsx — Tambahkan forwardRef
```jsx
const Button = forwardRef(function Button({ ...props }, ref) {
  // attach ref ke <button> atau <Link>
});
export default memo(Button);
export { buttonVariants };
```

#### 5. Modal.jsx — Tambahkan memo
```jsx
export default memo(function Modal({ ...props }) { });
```

#### 6. Alert.jsx — Tambahkan memo
```jsx
export default memo(function Alert({ ...props }) { });
```

#### 7. Badge.jsx — Hapus hardcoded colors
```jsx
// SEBELUM (badgeVariants.js):
BadgePresets = {
  verified: { color: "#3b82f6", ... },
  admin: { color: "#ef4444", ... },
  ...
}

// SESUDAH — gunakan CSS variables:
BadgePresets = {
  verified: { color: "var(--color-badge-verified)", ... },
  admin: { color: "var(--color-badge-admin)", ... },
  ...
}

// Tambahkan ke globals.css:
:root {
  --color-badge-verified: oklch(0.55 0.15 250);
  --color-badge-admin: oklch(0.55 0.2 25);
  --color-badge-moderator: oklch(0.65 0.15 75);
  --color-badge-contributor: oklch(0.55 0.15 290);
  --color-badge-premium: oklch(0.7 0.15 85);
  --color-badge-trusted: oklch(0.55 0.15 155);
}
```

#### 8. Avatar.jsx — Tambahkan memo
```jsx
export default memo(function Avatar({ ...props }) { });
```

#### 9. Hapus NativeSelect.jsx
```
NativeSelect dan Select overlap. Konsolidasikan:
- Select.jsx menangani semua use case
- Jika perlu native select (untuk mobile optimization), tambahkan prop `native` ke Select
- Hapus NativeSelect.jsx setelah migrasi semua usage
```

#### 10. Konsistensi border-radius
```
AUDIT SEMUA komponen dan standardisasi:
- Container level (Card, Modal, Alert): rounded-xl (12px)
- Element level (Button, Input, Select): rounded-lg (8px)
- Small element (Badge, Tag, Chip): rounded-md (6px)
- Pill shape (hanya jika semantik): rounded-full

Jangan gunakan rounded-[var(--radius)] lagi — terlalu abstrak.
Explicit radius per level lebih maintainable.
```

---

## FILE STRUCTURE RECOMMENDATION

```
components/ui/
├── Accordion.jsx          # NEW
├── Alert.jsx              # UPDATE: tambah memo
├── Avatar.jsx             # UPDATE: tambah memo
├── Badge.jsx              # UPDATE: hapus hardcoded colors
├── badgeVariants.js       # UPDATE: CSS variables
├── Breadcrumb.jsx         # NEW
├── Button.jsx             # UPDATE: tambah forwardRef
├── Card.jsx               # KEEP (sudah bagus)
├── Checkbox.jsx           # NEW
├── EmptyState.jsx         # KEEP
├── FormLabel.jsx          # KEEP
├── Input.jsx              # UPDATE: tambah forwardRef
├── Modal.jsx              # UPDATE: tambah memo
├── Popover.jsx            # NEW
├── Portal.jsx             # KEEP
├── Progress.jsx           # NEW
├── Radio.jsx              # NEW
├── SearchInput.jsx        # KEEP
├── Select.jsx             # UPDATE: forwardRef + memo, absorb NativeSelect
├── Separator.jsx          # NEW
├── Skeleton.jsx           # KEEP (sudah bagus)
├── Spinner.jsx            # KEEP
├── Switch.jsx             # NEW
├── Tabs.jsx               # NEW
├── Textarea.jsx           # UPDATE: forwardRef + memo
├── Toast.jsx              # KEEP
├── Tooltip.jsx            # NEW
├── ...tag/markdown/table components (keep)
```

---

*Gunakan prompt ini bersama dengan `.ai/prompts/ui-overhaul.md` (prompt utama) saat 
mengimplementasi komponen baru atau meng-update yang existing.*
