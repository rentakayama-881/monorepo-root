package handlers

import (
	"time"

	"backend-gin/services"
)

type chatGPTListingFlight struct {
	done chan struct{}
	resp *services.LZTMarketResponse
	err  error
}

type lztProxyRequest struct {
	Method      string            `json:"method" binding:"required"`
	Path        string            `json:"path" binding:"required"`
	Query       map[string]string `json:"query"`
	ContentType string            `json:"content_type"`
	JSONBody    interface{}       `json:"json_body"`
	FormBody    map[string]string `json:"form_body"`
}

type createPublicMarketOrderRequest struct {
	ItemID string `json:"item_id" binding:"required"`
	I18n   string `json:"i18n"`
}

type publicMarketOrder struct {
	ID               string                 `json:"id"`
	UserID           uint                   `json:"-"`
	ItemID           string                 `json:"item_id"`
	Title            string                 `json:"title"`
	Price            string                 `json:"price"`
	Status           string                 `json:"status"`
	Seller           string                 `json:"seller"`
	FailureReason    string                 `json:"failure_reason,omitempty"`
	FailureCode      string                 `json:"failure_code,omitempty"`
	Delivery         map[string]interface{} `json:"delivery,omitempty"`
	SourcePrice      float64                `json:"source_price,omitempty"`
	SourceCurrency   string                 `json:"source_currency,omitempty"`
	SourceSymbol     string                 `json:"source_symbol,omitempty"`
	PriceIDR         int64                  `json:"price_idr,omitempty"`
	FXRateToIDR      float64                `json:"fx_rate_to_idr,omitempty"`
	PriceDisplay     string                 `json:"price_display,omitempty"`
	SourceDisplay    string                 `json:"source_display,omitempty"`
	PricingNote      string                 `json:"pricing_note,omitempty"`
	Steps            []publicOrderStep      `json:"steps,omitempty"`
	LastStepCode     string                 `json:"last_step_code,omitempty"`
	SupplierCurrency string                 `json:"supplier_currency,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

func (o *publicMarketOrder) toClientDTO(withDelivery bool) publicMarketOrder {
	copy := *o
	if !withDelivery {
		copy.Delivery = nil
	}
	return copy
}

type publicOrderStep struct {
	Code    string    `json:"code"`
	Label   string    `json:"label"`
	Status  string    `json:"status"`
	Message string    `json:"message,omitempty"`
	At      time.Time `json:"at"`
}

type supplierBalanceState string

const (
	supplierBalanceStateEnough       supplierBalanceState = "enough"
	supplierBalanceStateInsufficient supplierBalanceState = "insufficient"
	supplierBalanceStateUnknown      supplierBalanceState = "unknown"
)

type supplierBalanceCheckResult struct {
	State   supplierBalanceState
	Balance float64
	Reason  string
}

type providerItemReadiness struct {
	Item            map[string]interface{}
	CanBuy          bool
	CannotBuyReason string
}
