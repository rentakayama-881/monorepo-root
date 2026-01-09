//go:build ignore
// +build ignore

package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"backend-gin/ent"
	entadmin "backend-gin/ent/admin"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

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

	// Connect to database using Ent
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	ctx := context.Background()
	client, err := ent.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer client.Close()

	// Run Ent auto-migration for Admin schema
	if err := client.Schema.Create(ctx); err != nil {
		log.Fatalf("Failed to create schema: %v", err)
	}

	// Check if admin already exists
	normalizedEmail := strings.ToLower(strings.TrimSpace(*email))
	exists, err := client.Admin.Query().
		Where(entadmin.EmailEQ(normalizedEmail)).
		Exist(ctx)
	if err != nil {
		log.Fatalf("Failed to check existing admin: %v", err)
	}
	if exists {
		log.Fatalf("Admin with email '%s' already exists", normalizedEmail)
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Create admin using Ent
	admin, err := client.Admin.Create().
		SetEmail(normalizedEmail).
		SetPasswordHash(string(hashedPassword)).
		SetName(*name).
		Save(ctx)
	if err != nil {
		log.Fatalf("Failed to create admin: %v", err)
	}

	fmt.Printf("✅ Admin created successfully!\n")
	fmt.Printf("   ID:    %d\n", admin.ID)
	fmt.Printf("   Email: %s\n", admin.Email)
	fmt.Printf("   Name:  %s\n", admin.Name)
	fmt.Println("\nYou can now login at /admin/login")
}
