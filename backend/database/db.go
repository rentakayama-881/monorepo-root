package database

import (
	"fmt"
	"os"

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

func InitDB() {
	// Prefer DATABASE_URL if provided (e.g. from Render/Heroku/Rails env)
	if url := os.Getenv("DATABASE_URL"); url != "" {
		db, err := gorm.Open(postgres.Open(url), &gorm.Config{})
		if err != nil {
			panic("Gagal terhubung ke PostgreSQL: " + err.Error())
		}
		DB = db
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
	migrateAndSeed()
}

func migrateAndSeed() {
	// Auto-migrate all models
	if err := DB.AutoMigrate(
		&models.User{},
		&models.Credential{},
		&models.Category{},
		&models.Thread{},
		&models.Transfer{},
		&models.EmailVerificationToken{},
		&DepositAddress{},
		// marketplace tables
		&models.Order{},
		&models.Dispute{},
		&models.Promotion{},
		&models.VolumeLedger{},
	); err != nil {
		panic("AutoMigrate gagal: " + err.Error())
	}

	// Seed categories if empty
	var count int64
	DB.Model(&models.Category{}).Count(&count)
	if count == 0 {
		seedCategories := []struct{ Slug, Name string }{
			{"mencari-pekerjaan", "Mencari Pekerjaan"},
			{"cryptocurrency", "Cryptocurrency"},
			{"software", "Software"},
			{"kerja-lepas", "Kerja Lepas"},
			{"iklan", "Iklan"},
			{"akuntansi", "Akuntansi"},
			{"dropshiper", "Dropshiper"},
			{"jasa-tugas-kantor", "Jasa Tugas Kantor"},
			{"akun-digital", "Akun Digital"},
			{"hp-komputer", "HP & Komputer"},
			{"drama-korea", "Drama Korea"},
			{"jasa-tugas-belajar", "Jasa Tugas Belajar"},
			{"kolaborator-phd", "Kolaborator Ph.D"},
			{"marketing-offline", "Marketing Offline"},
			{"investor", "Investor"},
			{"anti-penipuan", "Anti Penipuan"},
			{"dokter-buka-praktek", "Dokter Buka Praktek"},
			{"bantuan-darurat", "Bantuan Darurat"},
			{"cari-relasi", "Cari Relasi"},
			{"ai-digest", "AI Digest"},
			{"masa-depan-ku", "Masa Depan-Ku"},
			{"report-massal", "Report Massal"},
		}
		for _, c := range seedCategories {
			DB.Create(&models.Category{Slug: c.Slug, Name: c.Name})
		}
	}
}
