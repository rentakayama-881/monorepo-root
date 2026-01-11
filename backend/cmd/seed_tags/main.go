package main

import (
	"context"
	"log"

	"backend-gin/database"
	"backend-gin/ent/tag"
	"backend-gin/logger"
	_ "github.com/lib/pq"
)

func main() {
	// Initialize logger first
	logger.InitLogger()
	
	// Initialize database
	database.InitEntDB()
	defer database.CloseEntDB()

	client := database.GetEntClient()
	ctx := context.Background()

	// Define default tags for marketplace/community
	tags := []struct {
		Slug        string
		Name        string
		Description string
		Color       string
		Icon        string
		Order       int
	}{
		{
			Slug:        "service",
			Name:        "Service",
			Description: "Offering services or professional work",
			Color:       "#0969da", // GitHub blue
			Icon:        "briefcase",
			Order:       1,
		},
		{
			Slug:        "selling",
			Name:        "Selling",
			Description: "Selling products or items",
			Color:       "#1a7f37", // GitHub green
			Icon:        "tag",
			Order:       2,
		},
		{
			Slug:        "looking",
			Name:        "Looking For",
			Description: "Looking for services, products, or help",
			Color:       "#8250df", // GitHub purple
			Icon:        "search",
			Order:       3,
		},
		{
			Slug:        "hiring",
			Name:        "Hiring",
			Description: "Job opportunities and recruitment",
			Color:       "#bf3989", // GitHub pink
			Icon:        "people",
			Order:       4,
		},
		{
			Slug:        "collaboration",
			Name:        "Collaboration",
			Description: "Looking for collaboration or partnership",
			Color:       "#1f6feb", // GitHub brand blue
			Icon:        "git-merge",
			Order:       5,
		},
		{
			Slug:        "question",
			Name:        "Question",
			Description: "Asking questions or seeking advice",
			Color:       "#bc4c00", // GitHub orange
			Icon:        "question",
			Order:       6,
		},
		{
			Slug:        "discussion",
			Name:        "Discussion",
			Description: "General discussion or conversation",
			Color:       "#58a6ff", // GitHub light blue
			Icon:        "comment-discussion",
			Order:       7,
		},
		{
			Slug:        "announcement",
			Name:        "Announcement",
			Description: "Important announcements or updates",
			Color:       "#da3633", // GitHub red
			Icon:        "megaphone",
			Order:       8,
		},
		{
			Slug:        "tutorial",
			Name:        "Tutorial",
			Description: "Educational content and guides",
			Color:       "#6639ba", // GitHub deep purple
			Icon:        "book",
			Order:       9,
		},
		{
			Slug:        "showcase",
			Name:        "Showcase",
			Description: "Showcasing projects or achievements",
			Color:       "#d29922", // GitHub yellow
			Icon:        "star",
			Order:       10,
		},
	}

	// Create tags
	for _, t := range tags {
		// Check if tag already exists
		exists, err := client.Tag.Query().
			Where(tag.SlugEQ(t.Slug)).
			Exist(ctx)

		if err != nil {
			log.Printf("Error checking tag %s: %v", t.Slug, err)
			continue
		}

		if exists {
			log.Printf("Tag %s already exists, skipping...", t.Slug)
			continue
		}

		// Create tag
		_, err = client.Tag.Create().
			SetSlug(t.Slug).
			SetName(t.Name).
			SetDescription(t.Description).
			SetColor(t.Color).
			SetIcon(t.Icon).
			SetOrder(t.Order).
			SetIsActive(true).
			Save(ctx)

		if err != nil {
			log.Printf("Failed to create tag %s: %v", t.Slug, err)
		} else {
			log.Printf("✓ Created tag: %s (%s)", t.Name, t.Slug)
		}
	}

	log.Println("✓ Tag seeding completed!")
}
