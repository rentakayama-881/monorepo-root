package dto

type CreateThreadRequest struct {
	CategorySlug string      `json:"category_slug" binding:"required"`
	Title        string      `json:"title" binding:"required"`
	Summary      string      `json:"summary"`
	ContentType  string      `json:"content_type" binding:"required"`
	Content      interface{} `json:"content" binding:"required"`
	Meta         interface{} `json:"meta"` // image, telegram dsb masuk sini
}
