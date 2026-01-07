# 🐘 PostgreSQL Models

> Dokumentasi detail model-model PostgreSQL di Backend Gin.

---

## 🎯 ORM Overview

Backend Gin menggunakan dua ORM:

| ORM | Status | Usage |
|-----|--------|-------|
| **GORM** | Legacy, akan deprecated | Sebagian besar models |
| **Ent** | Migrasi bertahap | Models baru |

---

## 👤 User Model

```go
// models/user.go
type User struct {
    ID           uint           `gorm:"primaryKey" json:"id"`
    Email        string         `gorm:"uniqueIndex;not null" json:"email"`
    Username     string         `gorm:"uniqueIndex" json:"username"`
    FullName     string         `json:"fullName"`
    PasswordHash string         `gorm:"-" json:"-"` // Never expose
    AvatarURL    *string        `json:"avatarUrl"`
    Bio          *string        `json:"bio"`
    
    // Verification
    IsVerified   bool           `gorm:"default:false" json:"isVerified"`
    VerifiedAt   *time.Time     `json:"verifiedAt,omitempty"`
    
    // Security
    IsLocked     bool           `gorm:"default:false" json:"-"`
    LockedAt     *time.Time     `json:"-"`
    LockedReason *string        `json:"-"`
    
    // 2FA
    TOTPEnabled  bool           `gorm:"default:false" json:"totpEnabled"`
    TOTPSecret   *string        `gorm:"-" json:"-"` // Encrypted
    
    // Timestamps
    CreatedAt    time.Time      `json:"createdAt"`
    UpdatedAt    time.Time      `json:"updatedAt"`
    DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"` // Soft delete
    
    // Relations
    Threads      []Thread       `gorm:"foreignKey:AuthorID" json:"-"`
    Sessions     []Session      `gorm:"foreignKey:UserID" json:"-"`
    Credentials  []Credential   `gorm:"foreignKey:UserID" json:"-"`
    BackupCodes  []BackupCode   `gorm:"foreignKey:UserID" json:"-"`
    Badges       []UserBadge    `gorm:"foreignKey:UserID" json:"-"`
}
```

### User DTO

```go
// dto/user.go
type UserResponse struct {
    ID        uint    `json:"id"`
    Email     string  `json:"email"`
    Username  string  `json:"username"`
    FullName  string  `json:"fullName"`
    AvatarURL *string `json:"avatarUrl"`
    Bio       *string `json:"bio"`
    
    // Security status
    IsVerified  bool `json:"isVerified"`
    TOTPEnabled bool `json:"totpEnabled"`
    HasPasskeys bool `json:"hasPasskeys"`
    
    // Stats
    ThreadCount int `json:"threadCount"`
    BadgeCount  int `json:"badgeCount"`
}

type PublicUserResponse struct {
    Username  string  `json:"username"`
    FullName  string  `json:"fullName"`
    AvatarURL *string `json:"avatarUrl"`
    Bio       *string `json:"bio"`
    
    // Public stats
    ThreadCount int         `json:"threadCount"`
    Badges      []BadgeInfo `json:"badges"`
    JoinedAt    time.Time   `json:"joinedAt"`
}
```

---

## 📝 Thread Model

```go
// models/thread.go
type Thread struct {
    ID          uint           `gorm:"primaryKey" json:"id"`
    Title       string         `gorm:"size:200;not null" json:"title"`
    Summary     string         `gorm:"size:500" json:"summary"`
    ContentJSON datatypes.JSON `gorm:"type:jsonb" json:"contentJson"`
    
    // Relations
    CategoryID  uint           `gorm:"not null" json:"categoryId"`
    Category    Category       `gorm:"foreignKey:CategoryID" json:"category"`
    AuthorID    uint           `gorm:"not null" json:"authorId"`
    Author      User           `gorm:"foreignKey:AuthorID" json:"author"`
    
    // Status
    IsPublished bool           `gorm:"default:true" json:"isPublished"`
    IsDeleted   bool           `gorm:"default:false" json:"-"`
    
    // Timestamps
    CreatedAt   time.Time      `json:"createdAt"`
    UpdatedAt   time.Time      `json:"updatedAt"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
```

### Content JSON Structure

```json
{
  "type": "table",
  "columns": [
    { "key": "step", "label": "Langkah" },
    { "key": "action", "label": "Aksi" }
  ],
  "rows": [
    { "step": "1", "action": "Install dependencies" },
    { "step": "2", "action": "Configure environment" }
  ]
}
```

---

## 📂 Category Model

```go
// models/category.go
type Category struct {
    ID          uint   `gorm:"primaryKey" json:"id"`
    Name        string `gorm:"size:100;not null" json:"name"`
    Slug        string `gorm:"uniqueIndex;size:100" json:"slug"`
    Description string `gorm:"size:500" json:"description"`
    Color       string `gorm:"size:7" json:"color"` // #RRGGBB
    Icon        string `gorm:"size:50" json:"icon"` // Emoji or icon name
    OrderIndex  int    `gorm:"default:0" json:"orderIndex"`
    
    // Stats (computed)
    ThreadCount int    `gorm:"-" json:"threadCount"`
    
    CreatedAt   time.Time `json:"createdAt"`
}
```

---

## 🔐 Session Model

```go
// models/session.go
type Session struct {
    ID                string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    UserID            uint           `gorm:"not null;index" json:"userId"`
    User              User           `gorm:"foreignKey:UserID" json:"-"`
    
    // Device info
    DeviceFingerprint string         `gorm:"size:100" json:"-"`
    IPAddress         string         `gorm:"size:45" json:"ipAddress"` // IPv6 compatible
    UserAgent         string         `gorm:"size:500" json:"userAgent"`
    DeviceName        string         `gorm:"size:100" json:"deviceName"` // Parsed user agent
    
    // Status
    IsRevoked         bool           `gorm:"default:false" json:"-"`
    RevokedAt         *time.Time     `json:"-"`
    
    // Timing
    ExpiresAt         time.Time      `gorm:"not null" json:"expiresAt"`
    LastActiveAt      time.Time      `json:"lastActiveAt"`
    CreatedAt         time.Time      `json:"createdAt"`
}
```

---

## 🔑 Credential Model (Passkeys)

```go
// models/credential.go
type Credential struct {
    ID              uint      `gorm:"primaryKey" json:"id"`
    UserID          uint      `gorm:"not null;index" json:"userId"`
    User            User      `gorm:"foreignKey:UserID" json:"-"`
    
    // WebAuthn data
    CredentialID    []byte    `gorm:"uniqueIndex;not null" json:"-"`
    PublicKey       []byte    `gorm:"not null" json:"-"`
    AttestationType string    `gorm:"size:50" json:"-"`
    SignCount       uint32    `json:"-"`
    
    // User-facing info
    Name            string    `gorm:"size:100" json:"name"` // "MacBook Pro", "iPhone 15"
    
    // Timestamps
    CreatedAt       time.Time `json:"createdAt"`
    LastUsedAt      *time.Time `json:"lastUsedAt"`
}
```

---

## 🛡️ BackupCode Model

```go
// models/backup_code.go
type BackupCode struct {
    ID        uint       `gorm:"primaryKey" json:"id"`
    UserID    uint       `gorm:"not null;index" json:"userId"`
    User      User       `gorm:"foreignKey:UserID" json:"-"`
    
    CodeHash  string     `gorm:"size:100;not null" json:"-"` // bcrypt hash
    
    IsUsed    bool       `gorm:"default:false" json:"isUsed"`
    UsedAt    *time.Time `json:"usedAt,omitempty"`
    
    CreatedAt time.Time  `json:"createdAt"`
}
```

---

## 🏅 Badge Models

```go
// models/badge.go
type Badge struct {
    ID          uint   `gorm:"primaryKey" json:"id"`
    Name        string `gorm:"size:50;not null" json:"name"`
    Description string `gorm:"size:200" json:"description"`
    IconURL     string `gorm:"size:500" json:"iconUrl"`
    Color       string `gorm:"size:7" json:"color"`
    
    // Rarity affects display
    Rarity      string `gorm:"size:20;default:'common'" json:"rarity"` // common, rare, epic, legendary
    
    // Criteria (optional, for automatic award)
    CriteriaJSON datatypes.JSON `gorm:"type:jsonb" json:"-"`
    
    CreatedAt   time.Time `json:"createdAt"`
}

// models/user_badge.go
type UserBadge struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    UserID    uint      `gorm:"not null;index" json:"userId"`
    User      User      `gorm:"foreignKey:UserID" json:"-"`
    BadgeID   uint      `gorm:"not null;index" json:"badgeId"`
    Badge     Badge     `gorm:"foreignKey:BadgeID" json:"badge"`
    
    IsPrimary bool      `gorm:"default:false" json:"isPrimary"` // Display on profile
    
    AwardedAt time.Time `json:"awardedAt"`
    AwardedBy *uint     `json:"awardedBy"` // Admin ID, null for automatic
}
```

---

## 👑 Admin Model

```go
// models/admin.go
type Admin struct {
    ID           uint       `gorm:"primaryKey" json:"id"`
    Email        string     `gorm:"uniqueIndex;not null" json:"email"`
    Username     string     `gorm:"uniqueIndex;size:50" json:"username"`
    PasswordHash string     `gorm:"-" json:"-"`
    
    IsActive     bool       `gorm:"default:true" json:"isActive"`
    Role         string     `gorm:"size:20;default:'moderator'" json:"role"` // moderator, admin, super_admin
    
    LastLoginAt  *time.Time `json:"lastLoginAt"`
    LastLoginIP  *string    `json:"lastLoginIp"`
    
    CreatedAt    time.Time  `json:"createdAt"`
    UpdatedAt    time.Time  `json:"updatedAt"`
}
```

---

## 📧 Email Tokens

```go
// models/email_verification_token.go
type EmailVerificationToken struct {
    ID        uint      `gorm:"primaryKey"`
    UserID    uint      `gorm:"not null;index"`
    Token     string    `gorm:"uniqueIndex;size:100"`
    ExpiresAt time.Time `gorm:"not null"`
    CreatedAt time.Time
}

// models/password_reset_token.go
type PasswordResetToken struct {
    ID        uint      `gorm:"primaryKey"`
    UserID    uint      `gorm:"not null;index"`
    Token     string    `gorm:"uniqueIndex;size:100"`
    ExpiresAt time.Time `gorm:"not null"`
    UsedAt    *time.Time
    CreatedAt time.Time
}
```

---

## 🔒 Security Models

```go
// models/session_lock.go
type SessionLock struct {
    ID        uint      `gorm:"primaryKey"`
    UserID    uint      `gorm:"uniqueIndex;not null"`
    Reason    string    `gorm:"size:200"`
    LockedAt  time.Time
    ExpiresAt *time.Time // null = permanent
}

// models/device_fingerprint.go
type DeviceFingerprint struct {
    ID          uint      `gorm:"primaryKey"`
    UserID      uint      `gorm:"index"`
    Fingerprint string    `gorm:"index;size:100"`
    IsBlocked   bool      `gorm:"default:false"`
    FirstSeen   time.Time
    LastSeen    time.Time
    LoginCount  int       `gorm:"default:1"`
}
```

---

## 🔄 Model Hooks

```go
// models/user.go

// BeforeCreate hook - hash password before saving
func (u *User) BeforeCreate(tx *gorm.DB) error {
    if u.PasswordHash != "" {
        hash, err := bcrypt.GenerateFromPassword([]byte(u.PasswordHash), bcrypt.DefaultCost)
        if err != nil {
            return err
        }
        u.PasswordHash = string(hash)
    }
    return nil
}

// AfterFind hook - compute relations count
func (u *User) AfterFind(tx *gorm.DB) error {
    // Don't auto-load, use explicit queries
    return nil
}
```

---

## ▶️ Selanjutnya

- [42_MONGODB_COLLECTIONS.md](./42_MONGODB_COLLECTIONS.md) - MongoDB collections
- [43_DATABASE_MIGRATIONS.md](./43_DATABASE_MIGRATIONS.md) - Migrations
