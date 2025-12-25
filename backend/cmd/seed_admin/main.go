//go:build ignore
// +build ignore

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Admin model (copied to avoid import cycle)
type Admin struct {
	gorm.Model
	Email        string `gorm:"unique;not null"`
	PasswordHash string `gorm:"not null"`
	Name         string `gorm:"not null"`
}

func main() {
	// Parse flags
	email := flag.String("email", "", "Admin email address (required)")
	password := flag.String("password", "", "Admin password (required)")
	name := flag.String("name", "", "Admin display name (required)")
	flag.Parse()

	// Validate required flags
	if *email == "" || *password == "" || *name == "" {
		fmt.Println("Usage: go run cmd/seed_admin/main.go --email=admin@example.com --password=secret --name=\"Admin Name\"")
		fmt.Println("\nAll flags are required:")
		fmt.Println("  --email     Admin email address")
		fmt.Println("  --password  Admin password (min 8 characters)")
		fmt.Println("  --name      Admin display name")
		os.Exit(1)
	}

	if len(*password) < 8 {
		log.Fatal("Password must be at least 8 characters")
	}

	// Load .env
	godotenv.Load()

	// Connect to database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate Admin table
	if err := db.AutoMigrate(&Admin{}); err != nil {
		log.Fatalf("Failed to migrate Admin table: %v", err)
	}

	// Check if admin already exists
	var existing Admin
	normalizedEmail := strings.ToLower(strings.TrimSpace(*email))
	if db.Where("email = ?", normalizedEmail).First(&existing).Error == nil {
		log.Fatalf("Admin with email '%s' already exists", normalizedEmail)
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Create admin
	admin := Admin{
		Email:        normalizedEmail,
		PasswordHash: string(hashedPassword),
		Name:         *name,
	}

	if err := db.Create(&admin).Error; err != nil {
		log.Fatalf("Failed to create admin: %v", err)
	}

	fmt.Printf("✅ Admin created successfully!\n")
	fmt.Printf("   ID:    %d\n", admin.ID)
	fmt.Printf("   Email: %s\n", admin.Email)
	fmt.Printf("   Name:  %s\n", admin.Name)
	fmt.Println("\nYou can now login at /admin/login")
}
