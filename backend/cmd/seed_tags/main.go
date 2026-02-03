package main

import (
	"context"
	"flag"
	"log"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/tag"
	"backend-gin/logger"
	_ "github.com/lib/pq"
)

func main() {
	deleteLegacy := flag.Bool("delete-legacy", false, "Hard-delete legacy tags (dangerous; clears thread-tag edges first)")
	flag.Parse()

	// Initialize logger first
	logger.InitLogger()

	// Initialize database
	database.InitEntDB()
	defer database.CloseEntDB()

	client := database.GetEntClient()
	ctx := context.Background()

	// Harvard-style tag taxonomy for AI work validation.
	// Dimensions are encoded in slug prefixes to stay separable for filtering:
	// - artifact-*: output/artefact type
	// - stage-*: workflow stage
	// - domain-*: technical domain
	// - evidence-*: validation/evidence status
	tags := []struct {
		Slug        string
		Name        string
		Description string
		Color       string
		Icon        string
		Order       int
	}{
		{
			Slug:        "artifact-specification",
			Name:        "Specification",
			Description: "Kebutuhan/kontrak output: scope, acceptance criteria, API/UX spec.",
			Color:       "#1f6feb",
			Icon:        "file-text",
			Order:       10,
		},
		{
			Slug:        "artifact-patch",
			Name:        "Patch",
			Description: "Perubahan kecil untuk memperbaiki bug/behavior spesifik.",
			Color:       "#1f6feb",
			Icon:        "diff",
			Order:       11,
		},
		{
			Slug:        "artifact-refactor",
			Name:        "Refactor",
			Description: "Perubahan struktur internal tanpa mengubah output fungsional utama.",
			Color:       "#1f6feb",
			Icon:        "git-branch",
			Order:       12,
		},
		{
			Slug:        "artifact-deployment",
			Name:        "Deployment",
			Description: "Rilis, konfigurasi, atau perubahan infra untuk deploy.",
			Color:       "#1f6feb",
			Icon:        "rocket",
			Order:       13,
		},
		{
			Slug:        "artifact-incident",
			Name:        "Incident",
			Description: "Gangguan produksi: outage, degradation, atau bug kritikal.",
			Color:       "#1f6feb",
			Icon:        "alert-triangle",
			Order:       14,
		},
		{
			Slug:        "artifact-review",
			Name:        "Review",
			Description: "Review kode/arsitektur/PR untuk validasi kualitas.",
			Color:       "#1f6feb",
			Icon:        "eye",
			Order:       15,
		},
		{
			Slug:        "artifact-documentation",
			Name:        "Documentation",
			Description: "Dokumentasi, guide, atau runbook.",
			Color:       "#1f6feb",
			Icon:        "book",
			Order:       16,
		},
		{
			Slug:        "artifact-benchmark",
			Name:        "Benchmark",
			Description: "Pengukuran performa: latency, throughput, load test.",
			Color:       "#1f6feb",
			Icon:        "gauge",
			Order:       17,
		},
		{
			Slug:        "stage-draft",
			Name:        "Draft",
			Description: "Masih eksplorasi; detail bisa berubah.",
			Color:       "#1f6feb",
			Icon:        "pencil",
			Order:       20,
		},
		{
			Slug:        "stage-in-progress",
			Name:        "In Progress",
			Description: "Sedang dikerjakan; butuh feedback parsial.",
			Color:       "#1f6feb",
			Icon:        "loader",
			Order:       21,
		},
		{
			Slug:        "stage-blocked",
			Name:        "Blocked",
			Description: "Terhenti karena dependency/akses/clarification.",
			Color:       "#1f6feb",
			Icon:        "ban",
			Order:       22,
		},
		{
			Slug:        "stage-ready",
			Name:        "Ready",
			Description: "Siap divalidasi/review; informasi sudah cukup.",
			Color:       "#1f6feb",
			Icon:        "check-circle",
			Order:       23,
		},
		{
			Slug:        "domain-frontend",
			Name:        "Frontend",
			Description: "UI, UX, accessibility, performance client.",
			Color:       "#1f6feb",
			Icon:        "layout",
			Order:       30,
		},
		{
			Slug:        "domain-backend",
			Name:        "Backend",
			Description: "API, business logic, server runtime.",
			Color:       "#1f6feb",
			Icon:        "server",
			Order:       31,
		},
		{
			Slug:        "domain-devops",
			Name:        "DevOps",
			Description: "CI/CD, infra, observability, ops.",
			Color:       "#1f6feb",
			Icon:        "cog",
			Order:       32,
		},
		{
			Slug:        "domain-database",
			Name:        "Database",
			Description: "Schema, query, indexing, migrations.",
			Color:       "#1f6feb",
			Icon:        "database",
			Order:       33,
		},
		{
			Slug:        "domain-security",
			Name:        "Security",
			Description: "AuthZ/AuthN, exploit, hardening, threat model.",
			Color:       "#1f6feb",
			Icon:        "shield",
			Order:       34,
		},
		{
			Slug:        "domain-auth",
			Name:        "Auth",
			Description: "Login, session, JWT, passkey, MFA.",
			Color:       "#1f6feb",
			Icon:        "key",
			Order:       35,
		},
		{
			Slug:        "evidence-needs-verification",
			Name:        "Needs Verification",
			Description: "Belum ada bukti kuat; perlu cek ulang/eksperimen.",
			Color:       "#1f6feb",
			Icon:        "help-circle",
			Order:       40,
		},
		{
			Slug:        "evidence-verified",
			Name:        "Verified",
			Description: "Ada bukti/hasil uji; klaim sudah tervalidasi.",
			Color:       "#1f6feb",
			Icon:        "check",
			Order:       41,
		},
		{
			Slug:        "evidence-reproducible",
			Name:        "Reproducible",
			Description: "Ada langkah reproducible (steps) / test case.",
			Color:       "#1f6feb",
			Icon:        "repeat",
			Order:       42,
		},
		{
			Slug:        "evidence-regression",
			Name:        "Regression",
			Description: "Perubahan memicu/mencegah regresi; perlu test coverage.",
			Color:       "#1f6feb",
			Icon:        "history",
			Order:       43,
		},
	}

	desired := make(map[string]struct{}, len(tags))
	for _, t := range tags {
		desired[t.Slug] = struct{}{}
	}

	for _, t := range tags {
		// Upsert by slug (update existing to keep taxonomy consistent)
		existing, err := client.Tag.Query().
			Where(tag.SlugEQ(t.Slug)).
			Only(ctx)
		if err != nil {
			if ent.IsNotFound(err) {
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
				continue
			}
			log.Printf("Error checking tag %s: %v", t.Slug, err)
			continue
		}

		_, err = client.Tag.UpdateOne(existing).
			SetName(t.Name).
			SetDescription(t.Description).
			SetColor(t.Color).
			SetIcon(t.Icon).
			SetOrder(t.Order).
			SetIsActive(true).
			Save(ctx)
		if err != nil {
			log.Printf("Failed to update tag %s: %v", t.Slug, err)
		} else {
			log.Printf("✓ Updated tag: %s (%s)", t.Name, t.Slug)
		}
	}

	// Deactivate legacy tags from the old marketplace/community seed list.
	legacySlugs := []string{
		"service",
		"selling",
		"looking",
		"hiring",
		"collaboration",
		"question",
		"discussion",
		"announcement",
		"tutorial",
		"showcase",
	}
	for _, slug := range legacySlugs {
		if _, keep := desired[slug]; keep {
			continue
		}
		_, err := client.Tag.
			Update().
			Where(tag.SlugEQ(slug)).
			SetIsActive(false).
			Save(ctx)
		if err != nil {
			// Don't fail the whole seed if a legacy tag doesn't exist.
			continue
		}
		log.Printf("✓ Deactivated legacy tag: %s", slug)
	}

	if *deleteLegacy {
		for _, slug := range legacySlugs {
			if _, keep := desired[slug]; keep {
				continue
			}
			existing, err := client.Tag.Query().
				Where(tag.SlugEQ(slug)).
				Only(ctx)
			if err != nil {
				continue
			}

			// Clear join-table edges first to avoid FK constraint issues
			if _, err := client.Tag.UpdateOne(existing).ClearThreads().Save(ctx); err != nil {
				log.Printf("Failed to clear edges for legacy tag %s: %v", slug, err)
				continue
			}
			if err := client.Tag.DeleteOne(existing).Exec(ctx); err != nil {
				log.Printf("Failed to delete legacy tag %s: %v", slug, err)
				continue
			}
			log.Printf("✓ Deleted legacy tag: %s", slug)
		}
	}

	log.Println("✓ Tag seeding completed!")
}
