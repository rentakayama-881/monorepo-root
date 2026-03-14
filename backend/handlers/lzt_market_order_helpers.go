package handlers

import (
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/services"
)

func mapEntityToPublicMarketOrder(row *ent.MarketPurchaseOrder) publicMarketOrder {
	if row == nil {
		return publicMarketOrder{}
	}
	order := publicMarketOrder{
		ID:               strings.TrimSpace(row.OrderID),
		UserID:           uint(row.UserID),
		ItemID:           strings.TrimSpace(row.ItemID),
		Title:            strings.TrimSpace(row.Title),
		Price:            strings.TrimSpace(row.Price),
		Status:           strings.TrimSpace(row.Status),
		Seller:           strings.TrimSpace(row.Seller),
		FailureReason:    strings.TrimSpace(row.FailureReason),
		FailureCode:      strings.TrimSpace(row.FailureCode),
		SourcePrice:      row.SourcePrice,
		SourceCurrency:   strings.TrimSpace(row.SourceCurrency),
		SourceSymbol:     strings.TrimSpace(row.SourceSymbol),
		PriceIDR:         row.PriceIdr,
		FXRateToIDR:      row.FxRateToIdr,
		PriceDisplay:     strings.TrimSpace(row.PriceDisplay),
		SourceDisplay:    strings.TrimSpace(row.SourceDisplay),
		PricingNote:      strings.TrimSpace(row.PricingNote),
		LastStepCode:     strings.TrimSpace(row.LastStepCode),
		SupplierCurrency: strings.TrimSpace(row.SupplierCurrency),
		CreatedAt:        row.CreatedAt.UTC(),
		UpdatedAt:        row.UpdatedAt.UTC(),
	}
	if len(row.DeliveryJSON) > 0 {
		order.Delivery = row.DeliveryJSON
	}
	return order
}

func extractDeliveryPayload(resp *services.LZTMarketResponse) map[string]interface{} {
	payload := map[string]interface{}{
		"delivered_at": time.Now().UTC(),
	}
	if resp.JSON != nil {
		if extracted := extractCredentialsFromBuyResponse(resp.JSON); len(extracted) > 0 {
			payload["credentials"] = extracted
		}
		if summary := extractPurchasedItemSummary(resp.JSON); len(summary) > 0 {
			payload["account"] = summary
		}
	}
	return payload
}

func extractCredentialsFromBuyResponse(jsonPayload interface{}) map[string]interface{} {
	root, ok := jsonPayload.(map[string]interface{})
	if !ok {
		return nil
	}

	item := readMap(root, "item")
	if len(item) == 0 {
		return nil
	}

	out := map[string]interface{}{}
	login := readMap(item, "loginData")
	if len(login) > 0 {
		out["account_login"] = firstNonEmptyString(login, "login")
		out["account_password"] = firstNonEmptyString(login, "password")
	}

	email := readMap(item, "emailLoginData")
	if len(email) > 0 {
		out["email_login"] = firstNonEmptyString(email, "login")
		out["email_password"] = firstNonEmptyString(email, "password")
	}

	for key, value := range out {
		if strings.TrimSpace(fmt.Sprintf("%v", value)) == "" {
			delete(out, key)
		}
	}
	return out
}

func extractPurchasedItemSummary(jsonPayload interface{}) map[string]interface{} {
	root, ok := jsonPayload.(map[string]interface{})
	if !ok {
		return nil
	}
	item := readMap(root, "item")
	if len(item) == 0 {
		return nil
	}

	itemID := normalizeProviderIDValue(item["item_id"])
	summary := map[string]interface{}{
		"title":             normalizeItemTitle(item),
		"status":            firstNonEmptyString(item, "item_state"),
		"price":             firstNonEmptyString(item, "price", "priceWithSellerFee"),
		"email_domain":      firstNonEmptyString(item, "item_domain"),
		"openai_tier":       firstNonEmptyString(item, "openai_tier"),
		"country":           firstNonEmptyString(item, "chatgpt_country"),
		"subscription":      firstNonEmptyString(item, "chatgpt_subscription"),
		"seller":            normalizeSeller(item),
		"account_login_url": firstNonEmptyString(item, "accountLink"),
		"email_login_url":   firstNonEmptyString(item, "emailLoginUrl"),
	}
	if strings.TrimSpace(itemID) != "" {
		summary["item_id"] = itemID
	}
	for key, value := range summary {
		if strings.TrimSpace(fmt.Sprintf("%v", value)) == "" {
			delete(summary, key)
		}
	}
	return summary
}
