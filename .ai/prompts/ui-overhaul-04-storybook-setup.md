# Follow-Up #4: Storybook Setup

> Panduan setup Storybook untuk dokumentasi visual komponen UI AIValid.
> Storybook = katalog interaktif di mana kamu bisa lihat, test, dan develop 
> semua komponen secara terisolasi.

---

## APA ITU STORYBOOK?

Storybook adalah tool development yang:
- Menampilkan semua komponen UI di satu tempat (seperti katalog/showroom)
- Setiap komponen bisa dilihat dengan semua variant-nya (size, color, state)
- Bisa interact langsung (click button, input text, toggle dark mode)
- Otomatis generate dokumentasi dari props/types
- Bisa dipakai untuk visual regression testing
- Deploy sebagai static site (bisa di-share ke tim/stakeholder)

**Contoh:** Buka https://storybook.js.org/showcase untuk lihat contoh Storybook production.

---

## SETUP INSTRUCTIONS

### Step 1: Install

```bash
cd frontend
npx storybook@latest init --type nextjs
```

Ini akan:
- Install dependencies (@storybook/react, @storybook/nextjs, dll)
- Buat folder `.storybook/` dengan config
- Buat folder `stories/` dengan contoh (hapus setelah setup)

### Step 2: Konfigurasi `.storybook/main.js`

```javascript
/** @type {import('@storybook/nextjs').StorybookConfig} */
const config = {
  stories: [
    "../components/**/*.stories.@(js|jsx)",
    "../app/**/*.stories.@(js|jsx)",
  ],
  addons: [
    "@storybook/addon-essentials",    // Controls, Actions, Viewport, Backgrounds
    "@storybook/addon-a11y",          // Accessibility checker
    "@storybook/addon-themes",        // Light/Dark mode toggle
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],           // Serve fonts & images
};

export default config;
```

### Step 3: Konfigurasi `.storybook/preview.js`

```javascript
import "../app/globals.css";  // Load design tokens & styles

/** @type {import('@storybook/react').Preview} */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true }, // Kita handle via theme toggle
    layout: "centered",  // Default: centered components
  },
  decorators: [
    (Story, context) => {
      // Apply theme class to wrapper
      const theme = context.globals.theme || "light";
      return (
        <div className={theme} data-theme={theme}>
          <div className="bg-background text-foreground p-8 min-h-[200px]">
            <Story />
          </div>
        </div>
      );
    },
  ],
  globalTypes: {
    theme: {
      description: "Theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "sun",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
```

### Step 4: Install Addons

```bash
cd frontend
npm install -D @storybook/addon-a11y @storybook/addon-themes
```

### Step 5: Tambah Scripts ke package.json

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build -o storybook-static"
  }
}
```

### Step 6: Gitignore

Tambahkan ke `.gitignore`:
```
storybook-static/
```

---

## STORY FILE PATTERN

Setiap komponen punya file `.stories.jsx` di sebelahnya:

```
components/ui/
├── Button.jsx
├── Button.stories.jsx      ← Story file
├── Button.test.jsx          ← Test file (existing)
├── Card.jsx
├── Card.stories.jsx
└── ...
```

### Template Story File

```jsx
// components/ui/Button.stories.jsx
import Button from "./Button";
import { ArrowRight, Plus, Trash2 } from "lucide-react";

export default {
  title: "UI/Button",           // Folder structure di Storybook sidebar
  component: Button,
  tags: ["autodocs"],           // Auto-generate docs page
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "secondary", "outline", "ghost", "destructive", "link", "gradient"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon", "icon-sm", "icon-lg"],
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
};

// === STORIES ===

// Default (interactive via Controls panel)
export const Default = {
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

// All Variants (visual reference)
export const AllVariants = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button variant="gradient">Gradient</Button>
    </div>
  ),
};

// All Sizes
export const AllSizes = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

// With Icons
export const WithIcons = {
  render: () => (
    <div className="flex gap-3">
      <Button iconLeft={<Plus className="size-4" />}>Tambah</Button>
      <Button iconRight={<ArrowRight className="size-4" />}>Lanjut</Button>
      <Button variant="destructive" iconLeft={<Trash2 className="size-4" />}>Hapus</Button>
    </div>
  ),
};

// States
export const States = {
  render: () => (
    <div className="flex gap-3">
      <Button>Normal</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

// As Link
export const AsLink = {
  args: {
    children: "Go to page",
    href: "/example",
    variant: "outline",
  },
};
```

---

## STORY CHECKLIST PER KOMPONEN

Setiap komponen harus punya stories yang cover:

```
□ Default (dengan Controls interaktif)
□ All Variants (visual grid)
□ All Sizes (visual comparison)
□ States (normal, hover, focus, active, disabled, loading, error)
□ Dark Mode (otomatis via theme toggle)
□ Mobile (responsive preview via viewport addon)
□ Accessibility (otomatis via a11y addon)
□ Edge Cases (long text, empty, many items, etc.)
□ Composition (komponen di dalam context, misal: Button di dalam Card)
```

---

## PRIORITAS STORY CREATION

### Phase 1: Foundation Components
```
1. Button.stories.jsx
2. Input.stories.jsx  
3. Card.stories.jsx
4. Badge.stories.jsx
5. Alert.stories.jsx
```

### Phase 2: Form Components
```
6. Select.stories.jsx
7. Checkbox.stories.jsx (baru)
8. Radio.stories.jsx (baru)
9. Switch.stories.jsx (baru)
10. Textarea.stories.jsx
```

### Phase 3: Layout Components
```
11. Modal.stories.jsx
12. Tabs.stories.jsx (baru)
13. Accordion.stories.jsx (baru)
14. Breadcrumb.stories.jsx (baru)
15. Separator.stories.jsx (baru)
```

### Phase 4: Feedback Components
```
16. Toast.stories.jsx
17. Tooltip.stories.jsx (baru)
18. Popover.stories.jsx (baru)
19. Progress.stories.jsx (baru)
20. Skeleton.stories.jsx
21. Spinner.stories.jsx
22. EmptyState.stories.jsx
```

### Phase 5: Complex Components
```
23. Avatar.stories.jsx
24. SearchInput.stories.jsx
25. MarkdownEditor.stories.jsx
26. MarkdownPreview.stories.jsx
27. ValidationCaseTable.stories.jsx
```

---

## MENJALANKAN STORYBOOK

```bash
cd frontend

# Development (hot reload)
npm run storybook
# Buka http://localhost:6006

# Build static (untuk deploy/share)
npm run build-storybook
# Output di storybook-static/
```

---

*Storybook adalah investasi jangka panjang. Setelah setup, setiap komponen baru 
WAJIB disertai story file. Ini menjadi single source of truth untuk design system.*
