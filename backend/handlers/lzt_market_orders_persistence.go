package handlers

import (
	"context"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent/marketpurchaseorder"
)

func (h *LZTMarketHandler) saveOrder(order *publicMarketOrder) {
	if order == nil {
		return
	}
	client := database.GetEntClient()
	if client == nil {
		return
	}

	create := client.MarketPurchaseOrder.
		Create().
		SetOrderID(order.ID).
		SetUserID(int(order.UserID)).
		SetItemID(order.ItemID).
		SetTitle(order.Title).
		SetPrice(order.Price).
		SetStatus(order.Status).
		SetSeller(order.Seller).
		SetFailureReason(strings.TrimSpace(order.FailureReason)).
		SetFailureCode(strings.TrimSpace(order.FailureCode)).
		SetSourcePrice(order.SourcePrice).
		SetSourceCurrency(order.SourceCurrency).
		SetSourceSymbol(order.SourceSymbol).
		SetPriceIdr(order.PriceIDR).
		SetFxRateToIdr(order.FXRateToIDR).
		SetPriceDisplay(order.PriceDisplay).
		SetSourceDisplay(order.SourceDisplay).
		SetPricingNote(order.PricingNote).
		SetLastStepCode(order.LastStepCode).
		SetSupplierCurrency(order.SupplierCurrency).
		SetCreatedAt(order.CreatedAt.UTC()).
		SetUpdatedAt(order.UpdatedAt.UTC())

	if len(order.Delivery) > 0 {
		create = create.SetDeliveryJSON(order.Delivery)
	}
	if _, err := create.Save(context.Background()); err == nil {
		return
	}

	upd := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(order.ID)).
		SetItemID(order.ItemID).
		SetTitle(order.Title).
		SetPrice(order.Price).
		SetStatus(order.Status).
		SetSeller(order.Seller).
		SetFailureReason(strings.TrimSpace(order.FailureReason)).
		SetFailureCode(strings.TrimSpace(order.FailureCode)).
		SetSourcePrice(order.SourcePrice).
		SetSourceCurrency(order.SourceCurrency).
		SetSourceSymbol(order.SourceSymbol).
		SetPriceIdr(order.PriceIDR).
		SetFxRateToIdr(order.FXRateToIDR).
		SetPriceDisplay(order.PriceDisplay).
		SetSourceDisplay(order.SourceDisplay).
		SetPricingNote(order.PricingNote).
		SetLastStepCode(order.LastStepCode).
		SetSupplierCurrency(order.SupplierCurrency).
		SetUpdatedAt(order.UpdatedAt.UTC())
	if len(order.Delivery) > 0 {
		upd = upd.SetDeliveryJSON(order.Delivery)
	}
	_, _ = upd.Save(context.Background())
}

func (h *LZTMarketHandler) appendOrderStep(orderID string, step publicOrderStep) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	step.At = step.At.UTC()
	_, _ = client.MarketPurchaseOrderStep.
		Create().
		SetOrderID(orderID).
		SetCode(strings.TrimSpace(step.Code)).
		SetLabel(strings.TrimSpace(step.Label)).
		SetStatus(strings.TrimSpace(step.Status)).
		SetMessage(strings.TrimSpace(step.Message)).
		SetAt(step.At).
		SetCreatedAt(step.At).
		SetUpdatedAt(step.At).
		Save(context.Background())

	_, _ = client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetLastStepCode(strings.TrimSpace(step.Code)).
		SetUpdatedAt(step.At).
		Save(context.Background())
}

func (h *LZTMarketHandler) markOrderFailed(orderID, code, reason string) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	_, _ = client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetStatus("failed").
		SetFailureCode(strings.TrimSpace(code)).
		SetFailureReason(strings.TrimSpace(reason)).
		SetUpdatedAt(time.Now().UTC()).
		Save(context.Background())
}

func (h *LZTMarketHandler) markOrderFulfilled(orderID string, delivery map[string]interface{}) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	upd := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetStatus("fulfilled").
		SetFailureCode("").
		SetFailureReason("").
		SetUpdatedAt(time.Now().UTC())
	if len(delivery) > 0 {
		upd = upd.SetDeliveryJSON(delivery)
	}
	_, _ = upd.Save(context.Background())
}

func (h *LZTMarketHandler) getOrderForUser(orderID string, userID uint) (publicMarketOrder, bool) {
	client := database.GetEntClient()
	if client == nil {
		return publicMarketOrder{}, false
	}

	row, err := client.MarketPurchaseOrder.
		Query().
		Where(
			marketpurchaseorder.OrderIDEQ(orderID),
			marketpurchaseorder.UserIDEQ(int(userID)),
		).
		Only(context.Background())
	if err != nil {
		return publicMarketOrder{}, false
	}
	order := mapEntityToPublicMarketOrder(row)
	order.Steps = h.loadOrderSteps(context.Background(), row.OrderID)
	return order.toClientDTO(true), true
}
