package dto

// Semua field opsional agar bisa partial update
type UpdateThreadRequest struct {
    Title       *string     `json:"title"`
    Summary     *string     `json:"summary"`
    ContentType *string     `json:"content_type"`
    Content     interface{} `json:"content"`
    Meta        interface{} `json:"meta"` // contoh: { "image_url": "...", "telegram": "@username" }
}
