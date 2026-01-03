package database

import (
	"fmt"
	"os"
	"time"

	"backend-gin/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// configureConnectionPool sets up connection pool settings for production
func configureConnectionPool(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	// Set reasonable defaults for connection pooling
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)
	return nil
}

func InitDB() {
	// Prefer DATABASE_URL if provided (e.g. from Render/Heroku/Rails env)
	if url := os.Getenv("DATABASE_URL"); url != "" {
		db, err := gorm.Open(postgres.Open(url), &gorm.Config{})
		if err != nil {
			panic("Gagal terhubung ke PostgreSQL: " + err.Error())
		}
		DB = db
		if err := configureConnectionPool(DB); err != nil {
			panic("Gagal konfigurasi connection pool: " + err.Error())
		}
		migrateAndSeed()
		return
	}

	host := getenv("DB_HOST", "localhost")
	user := getenv("DB_USER", "postgres")
	pass := getenv("DB_PASSWORD", "")
	name := getenv("DB_NAME", "ballerina_dev")
	port := getenv("DB_PORT", "5432")
	sslmode := getenv("DB_SSLMODE", "disable")
	timezone := getenv("DB_TIMEZONE", "UTC")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		host, user, pass, name, port, sslmode, timezone)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic("Gagal terhubung ke PostgreSQL: " + err.Error())
	}
	DB = db
	if err := configureConnectionPool(DB); err != nil {
		panic("Gagal konfigurasi connection pool: " + err.Error())
	}
	migrateAndSeed()
}

func migrateAndSeed() {
	// Auto-migrate all models
	if err := DB.AutoMigrate(
		&models.User{},
		&models.Credential{},
		&models.Category{},
		&models.Thread{},
		&models.EmailVerificationToken{},
		&models.PasswordResetToken{},
		// Session & security tables
		&models.Session{},
		&models.SessionLock{},
		// TOTP / 2FA tables
		&models.BackupCode{},
		// Passkey / WebAuthn tables
		&models.Passkey{},
		// wallet & payment tables
		&models.UserWallet{},
		&models.Deposit{},
		&models.Transfer{},
		&models.Dispute{},
		&models.DisputeEvidence{},
		&models.DisputeMessage{},
		&models.Withdrawal{},
		&models.WalletTransaction{},
		// admin & badge tables
		&models.Admin{},
		&models.Badge{},
		&models.UserBadge{},
	); err != nil {
		panic("AutoMigrate gagal: " + err.Error())
	}

	// Migrate TOTPPendingToken separately (defined in services package)
	if err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS totp_pending_tokens (
			id SERIAL PRIMARY KEY,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			deleted_at TIMESTAMP,
			user_id INT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at TIMESTAMP NOT NULL,
			used_at TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_totp_pending_tokens_user_id ON totp_pending_tokens(user_id);
		CREATE INDEX IF NOT EXISTS idx_totp_pending_tokens_token_hash ON totp_pending_tokens(token_hash);
	`).Error; err != nil {
		panic("Failed to create totp_pending_tokens table: " + err.Error())
	}

	// Migrate SudoSession table (defined in services package)
	if err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS sudo_sessions (
			id SERIAL PRIMARY KEY,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			deleted_at TIMESTAMP,
			user_id INT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at TIMESTAMP NOT NULL,
			ip_address TEXT,
			user_agent TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_sudo_sessions_user_id ON sudo_sessions(user_id);
		CREATE INDEX IF NOT EXISTS idx_sudo_sessions_token_hash ON sudo_sessions(token_hash);
		CREATE INDEX IF NOT EXISTS idx_sudo_sessions_expires_at ON sudo_sessions(expires_at);
	`).Error; err != nil {
		panic("Failed to create sudo_sessions table: " + err.Error())
	}

	// Migrate SecurityEvent table for security audit logging
	if err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS security_events (
			id SERIAL PRIMARY KEY,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			deleted_at TIMESTAMP,
			user_id INT,
			email VARCHAR(255),
			event_type VARCHAR(50) NOT NULL,
			ip_address VARCHAR(45),
			user_agent VARCHAR(512),
			success BOOLEAN DEFAULT FALSE,
			details TEXT,
			severity VARCHAR(20) DEFAULT 'info',
			country VARCHAR(2),
			city VARCHAR(100)
		);
		CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
		CREATE INDEX IF NOT EXISTS idx_security_events_email ON security_events(email);
		CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
		CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
		CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
	`).Error; err != nil {
		panic("Failed to create security_events table: " + err.Error())
	}

	// Seed categories if empty
	var count int64
	DB.Model(&models.Category{}).Count(&count)
	if count == 0 {
		seedCategories := []struct{ Slug, Name, Description string }{
			{"mencari-pekerjaan", "Mencari Pekerjaan", "Lowongan kerja, tips karir, dan peluang pekerjaan"},
			{"cryptocurrency", "Cryptocurrency", "Bitcoin, altcoin, DeFi, NFT, dan teknologi blockchain"},
			{"software", "Software", "Aplikasi, tools, development, dan solusi software"},
			{"kerja-lepas", "Kerja Lepas", "Freelance, project-based, dan pekerjaan remote"},
			{"iklan", "Iklan", "Promosi produk, jasa, dan layanan bisnis"},
			{"akuntansi", "Akuntansi", "Pembukuan, laporan keuangan, dan jasa akuntan"},
			{"dropshiper", "Dropshiper", "Supplier, reseller, dan bisnis dropship"},
			{"jasa-tugas-kantor", "Jasa Tugas Kantor", "Jasa administrasi, data entry, dan pekerjaan kantor"},
			{"akun-digital", "Akun Digital", "Jual beli akun premium, subscription, dan lisensi digital"},
			{"hp-komputer", "HP & Komputer", "Gadget, komputer, laptop, dan aksesoris teknologi"},
			{"drama-korea", "Drama Korea", "Rekomendasi drama Korea, review, dan diskusi K-Drama"},
			{"jasa-tugas-belajar", "Jasa Tugas Belajar", "Jasa pengerjaan tugas sekolah, kuliah, dan akademik"},
			{"kolaborator-phd", "Kolaborator Ph.D", "Kolaborasi riset, thesis, dan proyek akademik Ph.D"},
			{"exploit-dev", "Exploit & Vulnerabilities", "Celah keamanan, CVE analysis, bug bounty, vulnerability research"},
			{"investor", "Investor", "Investor angel, venture capital, dan pendanaan bisnis"},
			{"anti-penipuan", "Anti Penipuan", "Laporan penipuan, blacklist, dan warning scammer"},
			{"cyber-security", "Cyber Security", "Keamanan siber, penetration testing, ethical hacking, defense strategies"},
			{"bantuan-darurat", "Bantuan Darurat", "Pertolongan darurat, donasi, dan bantuan mendesak"},
			{"cari-relasi", "Cari Relasi", "Networking, mencari partner bisnis, dan koneksi profesional"},
			{"ai-digest", "AI Digest", "Berita AI, machine learning, dan teknologi kecerdasan buatan"},
			{"malware-analysis", "Malware Analysis", "Reverse engineering, malware research, threat intelligence"},
			{"report-massal", "Report Massal", "Koordinasi laporan massal terhadap akun/konten berbahaya"},
		}
		for _, c := range seedCategories {
			DB.Create(&models.Category{Slug: c.Slug, Name: c.Name, Description: c.Description})
		}
	}
}
