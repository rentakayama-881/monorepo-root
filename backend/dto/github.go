package dto

type GithubUser struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

type GithubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}
