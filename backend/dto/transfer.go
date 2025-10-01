package dto

type TransferBalanceRequest struct {
	RecipientUsername string  `json:"recipient_username" binding:"required"`
	Amount            float64 `json:"amount" binding:"required,min=1"`
	HoldPeriod        string  `json:"hold_period" binding:"required,oneof=1h 7d 12m"`
}
