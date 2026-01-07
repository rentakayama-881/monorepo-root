# ⚙️ Backend Gin Services

> Dokumentasi service layer yang berisi business logic.

---

## 🎯 Apa itu Service Layer?

Service adalah layer yang:
1. Berisi **business logic** utama
2. Orchestrates database operations
3. **Tidak tahu** tentang HTTP (tidak ada gin.Context)
4. Reusable oleh multiple handlers

```
Handler (HTTP concerns)
    │
    ▼
Service (Business Logic)
    │
    ▼
Database (Data Persistence)
```

---

## 📂 Daftar Service Files

| File | Deskripsi |
|------|-----------|
| `auth_service.go` | Login, Register, Token generation |
| `auth_service_ent.go` | Auth service dengan Ent ORM |
| `session_service.go` | Session management |
| `session_service_ent.go` | Session dengan Ent ORM |
| `totp_service.go` | TOTP 2FA operations |
| `totp_service_ent.go` | TOTP dengan Ent ORM |
| `sudo_service.go` | Sudo mode management |
| `sudo_service_ent.go` | Sudo dengan Ent ORM |
| `passkey_service.go` | WebAuthn/Passkey |
| `thread_service.go` | Thread CRUD (GORM) |
| `thread_service_ent.go` | Thread CRUD (Ent) |
| `user_service.go` | User operations |
| `user_service_ent.go` | User dengan Ent ORM |
| `device_tracker.go` | Device fingerprinting |
| `email_rate_limiter.go` | Email sending limits |
| `login_tracker.go` | Track login attempts |
| `security_audit.go` | Security logging |
| `interfaces.go` | Service interfaces |

---

## 🔐 AuthService

### Initialization

```go
func NewAuthService(db *gorm.DB) *AuthService {
    return &AuthService{
        db:     db,
        hasher: NewPasswordHasher(),
    }
}
```

### Key Methods

#### Register

```go
func (s *AuthService) Register(input validators.RegisterInput) (*AuthResponse, error)
```

**Flow**:
1. Validate email format
2. Check email not already used
3. Check username not taken
4. Hash password dengan bcrypt
5. Create user record
6. Send verification email
7. Return success response

**Code Example**:
```go
func (s *AuthService) Register(input validators.RegisterInput) (*AuthResponse, error) {
    // Check existing email
    var existing models.User
    if err := s.db.Where("email = ?", input.Email).First(&existing).Error; err == nil {
        return nil, apperrors.ErrEmailExists
    }
    
    // Hash password
    hashedPassword, err := s.hasher.Hash(input.Password)
    if err != nil {
        return nil, apperrors.ErrInternal
    }
    
    // Create user
    user := &models.User{
        Email:        input.Email,
        Username:     input.Username,
        PasswordHash: hashedPassword,
        IsVerified:   false,
    }
    
    if err := s.db.Create(user).Error; err != nil {
        return nil, apperrors.ErrInternal
    }
    
    // Send verification email (async)
    go s.sendVerificationEmail(user)
    
    return &AuthResponse{
        Message:              "Registrasi berhasil",
        RequiresVerification: true,
    }, nil
}
```

#### Login

```go
func (s *AuthService) Login(email, password string) (*TokenPair, error)
```

**Flow**:
1. Find user by email
2. Check if verified
3. Verify password
4. Check if 2FA enabled → return temp token
5. Generate JWT token pair
6. Create session record
7. Return tokens

#### RegisterWithDevice

```go
func (s *AuthService) RegisterWithDevice(
    input validators.RegisterInput, 
    fingerprint string,
    ip string,
    userAgent string,
) (*AuthResponse, error)
```

Registers user dan tracks device for security.

---

## 🔄 SessionService

### Key Methods

#### CreateSession

```go
func (s *SessionService) CreateSession(userID uint, deviceInfo DeviceInfo) (*Session, error)
```

Creates session record with device metadata.

#### ValidateSession

```go
func (s *SessionService) ValidateSession(sessionID string) (*Session, error)
```

Checks if session is still valid.

#### RevokeSession

```go
func (s *SessionService) RevokeSession(sessionID string) error
```

Invalidates specific session.

#### RevokeAllSessions

```go
func (s *SessionService) RevokeAllSessions(userID uint) error
```

Invalidates all sessions for user (logout all devices).

---

## 🛡️ TOTPService

### Initialization

```go
func NewTOTPService(db *gorm.DB, logger *zap.Logger) *TOTPService {
    return &TOTPService{
        db:     db,
        logger: logger,
    }
}
```

### Key Methods

#### GenerateSecret

```go
func (s *TOTPService) GenerateSecret(userID uint) (*TOTPSetup, error)
```

**Returns**:
```go
type TOTPSetup struct {
    Secret      string // Base32 encoded
    QRCode      string // Base64 PNG image
    RecoveryKey string // Backup key
}
```

#### VerifyAndEnable

```go
func (s *TOTPService) VerifyAndEnable(userID uint, code string) error
```

Verifies TOTP code dan enables 2FA.

#### VerifyCode

```go
func (s *TOTPService) VerifyCode(userID uint, code string) (bool, error)
```

Validates TOTP code.

#### GenerateBackupCodes

```go
func (s *TOTPService) GenerateBackupCodes(userID uint) ([]string, error)
```

Generates 10 one-time backup codes.

---

## 🔑 PasskeyService

Uses WebAuthn library untuk passkey authentication.

### Initialization

```go
func NewPasskeyService(
    db *gorm.DB,
    logger *zap.Logger,
    rpID string,      // Relying Party ID (domain)
    rpOrigin string,  // Origin URL
    rpName string,    // Display name
) (*PasskeyService, error)
```

### Key Methods

#### BeginRegistration

```go
func (s *PasskeyService) BeginRegistration(userID uint) (*protocol.CredentialCreation, error)
```

Creates WebAuthn challenge untuk registration.

#### FinishRegistration

```go
func (s *PasskeyService) FinishRegistration(userID uint, response *protocol.CredentialCreationResponse) error
```

Verifies dan stores credential.

#### BeginLogin

```go
func (s *PasskeyService) BeginLogin(email string) (*protocol.CredentialAssertion, error)
```

Creates assertion challenge untuk login.

#### FinishLogin

```go
func (s *PasskeyService) FinishLogin(response *protocol.CredentialAssertionResponse) (*models.User, error)
```

Verifies assertion dan returns user.

---

## 🔒 SudoService

### Key Methods

#### Verify

```go
func (s *SudoService) Verify(userID uint, method, credential string) (*SudoToken, error)
```

**Methods**:
- `"password"` - Re-enter password
- `"totp"` - Enter TOTP code

**Returns**:
```go
type SudoToken struct {
    Token     string
    ExpiresAt time.Time
}
```

#### IsInSudoMode

```go
func (s *SudoService) IsInSudoMode(userID uint, token string) (bool, error)
```

Checks if user is in sudo mode.

---

## 📝 ThreadService

### Interface

```go
type ThreadServiceInterface interface {
    GetCategories(ctx context.Context) ([]Category, error)
    ListThreadsByCategory(ctx context.Context, slug string, limit int) (*CategoryThreads, error)
    ListLatestThreads(ctx context.Context, category string, limit int) ([]Thread, error)
    GetThreadByID(ctx context.Context, id uint) (*Thread, error)
    CreateThread(ctx context.Context, input CreateThreadInput) (*Thread, error)
    UpdateThread(ctx context.Context, id uint, input UpdateThreadInput) (*Thread, error)
    DeleteThread(ctx context.Context, id uint) error
    GetUserThreads(ctx context.Context, userID uint) ([]Thread, error)
}
```

### GORM Implementation

```go
func NewThreadService(db *gorm.DB) *ThreadService {
    return &ThreadService{db: db}
}
```

### Ent Implementation

```go
func NewEntThreadService() *EntThreadService {
    return &EntThreadService{
        client: database.GetEntClient(),
    }
}
```

### CreateThread Example

```go
func (s *ThreadService) CreateThread(ctx context.Context, input CreateThreadInput) (*Thread, error) {
    // Validate category exists
    var category models.Category
    if err := s.db.First(&category, input.CategoryID).Error; err != nil {
        return nil, apperrors.ErrCategoryNotFound
    }
    
    // Create thread
    thread := &models.Thread{
        Title:       input.Title,
        Summary:     input.Summary,
        ContentJSON: input.ContentJSON,
        CategoryID:  input.CategoryID,
        AuthorID:    input.AuthorID,
    }
    
    if err := s.db.Create(thread).Error; err != nil {
        return nil, apperrors.ErrInternal
    }
    
    return thread.ToDTO(), nil
}
```

---

## 👤 UserService

### Key Methods

```go
func (s *UserService) GetByID(ctx context.Context, id uint) (*User, error)
func (s *UserService) GetByUsername(ctx context.Context, username string) (*User, error)
func (s *UserService) GetByEmail(ctx context.Context, email string) (*User, error)
func (s *UserService) UpdateProfile(ctx context.Context, id uint, input UpdateProfileInput) error
func (s *UserService) ChangeUsername(ctx context.Context, id uint, newUsername string) error
func (s *UserService) UploadAvatar(ctx context.Context, id uint, file io.Reader) (string, error)
```

---

## 🔍 Security Services

### DeviceTracker

Tracks devices untuk security alerts.

```go
func (t *DeviceTracker) TrackDevice(userID uint, fingerprint, ip, userAgent string) error
func (t *DeviceTracker) IsKnownDevice(userID uint, fingerprint string) bool
func (t *DeviceTracker) GetUserDevices(userID uint) ([]Device, error)
```

### LoginTracker

Tracks login attempts untuk brute force protection.

```go
func (t *LoginTracker) RecordAttempt(email string, success bool, ip string) error
func (t *LoginTracker) IsLocked(email string) bool
func (t *LoginTracker) GetAttemptCount(email string) int
```

### SecurityAudit

Logs security events.

```go
func (a *SecurityAudit) Log(event SecurityEvent) error

type SecurityEvent struct {
    UserID    uint
    EventType string // "login", "password_change", etc.
    IP        string
    UserAgent string
    Success   bool
    Details   map[string]interface{}
}
```

---

## 🎯 Service Patterns

### 1. Dependency Injection

```go
// Interface
type UserServiceInterface interface {
    GetByID(ctx context.Context, id uint) (*User, error)
}

// Implementation
type UserService struct {
    db *gorm.DB
}

func NewUserService(db *gorm.DB) UserServiceInterface {
    return &UserService{db: db}
}

// Usage in handler
type Handler struct {
    userService UserServiceInterface
}

func NewHandler(us UserServiceInterface) *Handler {
    return &Handler{userService: us}
}
```

### 2. Error Wrapping

```go
func (s *Service) DoSomething() error {
    if err := s.db.Create(item).Error; err != nil {
        // Wrap dengan konteks
        return apperrors.ErrInternal.WithDetails("failed to create item")
    }
    return nil
}
```

### 3. Transaction Handling

```go
func (s *Service) ComplexOperation() error {
    tx := s.db.Begin()
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
        }
    }()

    if err := tx.Create(item1).Error; err != nil {
        tx.Rollback()
        return err
    }

    if err := tx.Create(item2).Error; err != nil {
        tx.Rollback()
        return err
    }

    return tx.Commit().Error
}
```

---

## ▶️ Selanjutnya

- [24_BACKEND_GIN_MIDDLEWARE.md](./24_BACKEND_GIN_MIDDLEWARE.md) - Middlewares
- [../04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md](../04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md) - Feature Service
