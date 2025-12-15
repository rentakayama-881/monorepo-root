package dto

type RegisterRequest struct {
        Email    string  `json:"email" binding:"required"`
        Password string  `json:"password" binding:"required"`
        Username *string `json:"username"`
        FullName *string `json:"full_name"`
}

type LoginRequest struct {
        Email    string `json:"email" binding:"required"`
        Password string `json:"password" binding:"required"`
}

type VerifyRequest struct {
        Email string `json:"email" binding:"required"`
}

type VerifyConfirmRequest struct {
        Token string `json:"token" binding:"required"`
}
