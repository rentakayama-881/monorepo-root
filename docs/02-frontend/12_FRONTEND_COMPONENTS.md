# 🧩 Frontend Components

> Dokumen ini menjelaskan komponen-komponen UI yang tersedia di folder `components/`.

---

## 📁 Struktur Folder Components

```
components/
├── ui/                     # 🎨 UI Primitives (building blocks)
│   ├── Alert.jsx           # Notifikasi/peringatan
│   ├── Avatar.jsx          # User avatar
│   ├── Badge.jsx           # Status badge
│   ├── Button.jsx          # Tombol
│   ├── Card.jsx            # Card container
│   ├── Input.jsx           # Text input
│   ├── Label.jsx           # Form label
│   ├── Modal.jsx           # Dialog popup
│   ├── Select.jsx          # Dropdown select
│   ├── Skeleton.jsx        # Loading placeholder
│   ├── Spinner.jsx         # Loading spinner
│   ├── Textarea.jsx        # Multi-line input
│   ├── Toast.jsx           # Toast notification
│   ├── MarkdownEditor.jsx  # Markdown editor
│   ├── MarkdownPreview.jsx # Markdown renderer
│   └── ...
│
├── home/                   # 🏠 Homepage components
│   ├── Hero.jsx            # Hero section
│   ├── CategoryGrid.jsx    # Grid kategori
│   └── LatestThreads.jsx   # Thread terbaru
│
├── Header.js               # 📍 Navigation header
├── Footer.js               # 📍 Footer
├── Sidebar.js              # 📍 Sidebar
├── ReplyList.jsx           # 💬 Reply list
├── ReplyForm.jsx           # 💬 Reply form
├── ReactionBar.jsx         # 👍 Reaction bar
├── ReportModal.jsx         # 🚨 Report modal
├── SudoModal.jsx           # 🔒 Sudo mode modal
├── ProfileSidebar.js       # 👤 Profile sidebar
├── TOTPSettings.jsx        # 🔐 2FA settings
├── PasskeySettings.jsx     # 🔑 Passkey settings
└── ApiStatusBanner.jsx     # 🔔 API status banner
```

---

## 🎨 UI Primitives

### Button

**File**: `components/ui/Button.jsx`

```jsx
import Button from "@/components/ui/Button";

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>

// Full width
<Button fullWidth>Submit</Button>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | string | `"primary"` | Visual variant |
| `size` | string | `"md"` | Button size |
| `disabled` | boolean | `false` | Disabled state |
| `loading` | boolean | `false` | Loading state |
| `fullWidth` | boolean | `false` | Full width |
| `onClick` | function | - | Click handler |

---

### Input

**File**: `components/ui/Input.jsx`

```jsx
import Input from "@/components/ui/Input";

// Basic
<Input
  type="email"
  placeholder="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// With error
<Input
  type="password"
  placeholder="Password"
  error="Password harus minimal 8 karakter"
/>

// With icon
<Input
  type="search"
  placeholder="Cari..."
  icon={<SearchIcon />}
/>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | string | `"text"` | Input type |
| `placeholder` | string | - | Placeholder text |
| `value` | string | - | Controlled value |
| `onChange` | function | - | Change handler |
| `error` | string | - | Error message |
| `disabled` | boolean | `false` | Disabled state |

---

### Modal

**File**: `components/ui/Modal.jsx`

```jsx
import Modal from "@/components/ui/Modal";

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      
      <Modal 
        open={open} 
        onClose={() => setOpen(false)}
        title="Konfirmasi"
      >
        <p>Apakah Anda yakin ingin melanjutkan?</p>
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Ya, Lanjutkan
          </Button>
        </div>
      </Modal>
    </>
  );
}
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | boolean | `false` | Visibility state |
| `onClose` | function | - | Close handler |
| `title` | string | - | Modal title |
| `children` | ReactNode | - | Modal content |

---

### Alert

**File**: `components/ui/Alert.jsx`

```jsx
import Alert from "@/components/ui/Alert";

<Alert type="success">Berhasil menyimpan data!</Alert>
<Alert type="error">Terjadi kesalahan</Alert>
<Alert type="warning">Peringatan: Token hampir habis</Alert>
<Alert type="info">Info: Fitur baru tersedia</Alert>
```

**Types**:
- `success` - Hijau, untuk aksi berhasil
- `error` - Merah, untuk error
- `warning` - Kuning, untuk peringatan
- `info` - Biru, untuk informasi

---

### Toast

**File**: `components/ui/Toast.jsx`

```jsx
import { useToast } from "@/components/ui/Toast";

function MyComponent() {
  const { toast } = useToast();

  const handleSave = () => {
    try {
      // save logic
      toast.success("Berhasil", "Data tersimpan");
    } catch (error) {
      toast.error("Gagal", error.message);
    }
  };

  // Other methods
  toast.info("Info", "Proses sedang berjalan");
  toast.warning("Perhatian", "Token hampir habis");
}
```

**Methods**:
| Method | Description |
|--------|-------------|
| `toast.success(title, message)` | Green toast |
| `toast.error(title, message)` | Red toast |
| `toast.warning(title, message)` | Yellow toast |
| `toast.info(title, message)` | Blue toast |

---

### Skeleton

**File**: `components/ui/Skeleton.jsx`

```jsx
import Skeleton, { 
  SkeletonText, 
  SkeletonCircle,
  SkeletonListItem 
} from "@/components/ui/Skeleton";

// Basic skeleton
<Skeleton className="h-4 w-full" />
<Skeleton className="h-8 w-48" />

// Text skeleton
<SkeletonText width="w-full" height="h-4" />
<SkeletonText width="w-3/4" />

// Avatar skeleton
<SkeletonCircle size="h-10 w-10" />

// List item skeleton
<SkeletonListItem />
```

**Exported Components**:
- `Skeleton` - Base skeleton
- `SkeletonText` - Text line
- `SkeletonCircle` - Avatar/circle
- `SkeletonListItem` - List item
- `SkeletonBalanceCard` - Wallet balance card
- `SkeletonPage` - Full page skeleton

---

### Avatar

**File**: `components/ui/Avatar.jsx`

```jsx
import Avatar from "@/components/ui/Avatar";

// With image
<Avatar 
  src="https://example.com/avatar.jpg" 
  alt="John Doe"
  size="md"
/>

// Fallback to initials
<Avatar 
  name="John Doe" 
  size="lg"
/>

// Sizes
<Avatar size="sm" /> {/* 32px */}
<Avatar size="md" /> {/* 40px */}
<Avatar size="lg" /> {/* 48px */}
<Avatar size="xl" /> {/* 64px */}
```

---

### Card

**File**: `components/ui/Card.jsx`

```jsx
import Card from "@/components/ui/Card";

<Card>
  <Card.Header>
    <h3>Card Title</h3>
  </Card.Header>
  <Card.Body>
    <p>Card content here...</p>
  </Card.Body>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>
```

---

### Badge

**File**: `components/ui/Badge.jsx`

```jsx
import Badge from "@/components/ui/Badge";

<Badge>Default</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Expired</Badge>
<Badge variant="info">New</Badge>
```

---

### Spinner

**File**: `components/ui/Spinner.jsx`

```jsx
import Spinner from "@/components/ui/Spinner";

<Spinner />
<Spinner size="sm" />
<Spinner size="lg" />
<Spinner className="text-primary" />
```

---

## 💬 Feature Components

### ReplyList

**File**: `components/ReplyList.jsx`

Menampilkan daftar reply dengan nesting sampai depth 3.

```jsx
import ReplyList from "@/components/ReplyList";

<ReplyList 
  threadId="123"
  currentUsername="johndoe"
  onReplySuccess={refetchReplies}
/>
```

**Features**:
- Nested replies (indent visual)
- Reply button per item
- Delete button (author only)
- Loading skeleton
- Relative time (e.g., "2 jam lalu")

---

### ReplyForm

**File**: `components/ReplyForm.jsx`

Form untuk membuat reply baru.

```jsx
import ReplyForm from "@/components/ReplyForm";

<ReplyForm 
  threadId="123"
  parentReplyId={null} // null untuk top-level
  onSuccess={() => refetch()}
  onCancel={() => setShowForm(false)}
/>
```

---

### ReactionBar

**File**: `components/ReactionBar.jsx`

Bar untuk menampilkan dan menambah reaction.

```jsx
import ReactionBar from "@/components/ReactionBar";

<ReactionBar 
  threadId="123"
  initialReactions={{
    like: 12,
    love: 5,
    fire: 3,
    sad: 0,
    laugh: 2
  }}
  userReaction="like" // reaction user saat ini
/>
```

**Reaction Types**:
| Type | Emoji | Display |
|------|-------|---------|
| `like` | 👍 | Like |
| `love` | ❤️ | Love |
| `fire` | 🔥 | Fire |
| `sad` | 😢 | Sad |
| `laugh` | 😂 | Laugh |

---

### ReportModal

**File**: `components/ReportModal.jsx`

Modal untuk melaporkan konten.

```jsx
import ReportModal from "@/components/ReportModal";

<ReportModal
  open={showReport}
  onClose={() => setShowReport(false)}
  targetType="thread" // atau "reply"
  targetId="123"
/>
```

---

### SudoModal

**File**: `components/SudoModal.jsx`

Modal untuk sudo mode (re-authentication).

```jsx
import SudoModal from "@/components/SudoModal";

<SudoModal
  open={needsSudo}
  onSuccess={(sudoToken) => {
    // Simpan sudo token
    // Lanjutkan aksi sensitif
  }}
  onClose={() => setNeedsSudo(false)}
/>
```

---

## 🏠 Home Components

### Hero

**File**: `components/home/Hero.jsx`

```jsx
import Hero from "@/components/home/Hero";

<Hero 
  title="Selamat Datang di Alephdraad"
  subtitle="Platform komunitas untuk berbagi pengetahuan"
/>
```

### CategoryGrid

**File**: `components/home/CategoryGrid.jsx`

```jsx
import CategoryGrid from "@/components/home/CategoryGrid";

<CategoryGrid categories={categories} />
```

### LatestThreads

**File**: `components/home/LatestThreads.jsx`

```jsx
import LatestThreads from "@/components/home/LatestThreads";

<LatestThreads threads={latestThreads} />
```

---

## 📝 Markdown Components

### MarkdownEditor

**File**: `components/ui/MarkdownEditor.jsx`

Editor markdown dengan preview.

```jsx
import MarkdownEditor from "@/components/ui/MarkdownEditor";

<MarkdownEditor
  value={content}
  onChange={setContent}
  placeholder="Tulis konten dalam format Markdown..."
/>
```

### MarkdownPreview

**File**: `components/ui/MarkdownPreview.jsx`

Render markdown ke HTML.

```jsx
import MarkdownPreview from "@/components/ui/MarkdownPreview";

<MarkdownPreview content={markdownContent} />
```

**Features**:
- GitHub Flavored Markdown (GFM)
- Syntax highlighting untuk code blocks
- Support tables, lists, links

---

## 🔐 Security Components

### TOTPSettings

**File**: `components/TOTPSettings.jsx`

Pengaturan Two-Factor Authentication.

```jsx
import TOTPSettings from "@/components/TOTPSettings";

<TOTPSettings 
  enabled={user.totpEnabled}
  onEnable={handleEnable}
  onDisable={handleDisable}
/>
```

### PasskeySettings

**File**: `components/PasskeySettings.jsx`

Pengaturan Passkey/WebAuthn.

```jsx
import PasskeySettings from "@/components/PasskeySettings";

<PasskeySettings 
  passkeys={userPasskeys}
  onRegister={handleRegister}
  onDelete={handleDelete}
/>
```

---

## 🎨 Component Design Patterns

### Pattern 1: Controlled Component

```jsx
function ControlledInput({ value, onChange }) {
  return (
    <input 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
```

### Pattern 2: Compound Component

```jsx
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### Pattern 3: Render Props

```jsx
<DataFetcher url="/api/data">
  {({ data, loading, error }) => (
    loading ? <Spinner /> : <DataDisplay data={data} />
  )}
</DataFetcher>
```

---

## ▶️ Selanjutnya

- [13_FRONTEND_HOOKS.md](./13_FRONTEND_HOOKS.md) - Custom hooks
- [14_FRONTEND_API_CLIENTS.md](./14_FRONTEND_API_CLIENTS.md) - API integration
