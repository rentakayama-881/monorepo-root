package services

// Thread service response types
// These types are used by both interfaces and implementations

// CategoryResponse represents a category in API responses
type CategoryResponse struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ThreadListItem represents a thread in list responses
type ThreadListItem struct {
	ID        uint             `json:"id"`
	Title     string           `json:"title"`
	Summary   string           `json:"summary"`
	Username  string           `json:"username"`
	Category  CategoryResponse `json:"category"`
	CreatedAt int64            `json:"created_at"`
}

// UserInfo represents user info in thread responses
type UserInfo struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// ThreadDetailResponse represents detailed thread information
type ThreadDetailResponse struct {
	ID          uint                   `json:"id"`
	Title       string                 `json:"title"`
	Summary     string                 `json:"summary"`
	ContentType string                 `json:"content_type"`
	Content     map[string]interface{} `json:"content"`
	Meta        map[string]interface{} `json:"meta,omitempty"`
	CreatedAt   int64                  `json:"created_at"`
	User        UserInfo               `json:"user"`
	Category    CategoryResponse       `json:"category"`
}

// CategoryWithThreadsResponse represents a category with its threads
type CategoryWithThreadsResponse struct {
	Category CategoryResponse `json:"category"`
	Threads  []ThreadListItem `json:"threads"`
}
