package handlers

import (
	"context"
	"strings"
	"time"

	applog "backend-gin/logger"

	"backend-gin/database"
	"backend-gin/ent/marketpurchaseorder"
	"go.uber.org/zap"
)

func (h *LZTMarketHandler) saveOrder(ctx context.Context, order *publicMarketOrder) {
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
	if _, err := create.Save(ctx); err == nil {
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
	if _, err := upd.Save(ctx); err != nil {
		applog.Warn("failed to upsert market order", zap.String("order_id", order.ID), zap.Error(err))
	}
}

func (h *LZTMarketHandler) appendOrderStep(ctx context.Context, orderID string, step publicOrderStep) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	step.At = step.At.UTC()
	if _, err := client.MarketPurchaseOrderStep.
		Create().
		SetOrderID(orderID).
		SetCode(strings.TrimSpace(step.Code)).
		SetLabel(strings.TrimSpace(step.Label)).
		SetStatus(strings.TrimSpace(step.Status)).
		SetMessage(strings.TrimSpace(step.Message)).
		SetAt(step.At).
		SetCreatedAt(step.At).
		SetUpdatedAt(step.At).
		Save(ctx); err != nil {
		applog.Warn("failed to save order step", zap.String("order_id", orderID), zap.String("step", step.Code), zap.Error(err))
	}

	if _, err := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetLastStepCode(strings.TrimSpace(step.Code)).
		SetUpdatedAt(step.At).
		Save(ctx); err != nil {
		applog.Warn("failed to update order last step", zap.String("order_id", orderID), zap.Error(err))
	}
}

func (h *LZTMarketHandler) markOrderFailed(ctx context.Context, orderID, code, reason string) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	if _, err := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetStatus("failed").
		SetFailureCode(strings.TrimSpace(code)).
		SetFailureReason(strings.TrimSpace(reason)).
		SetUpdatedAt(time.Now().UTC()).
		Save(ctx); err != nil {
		applog.Error("failed to mark order as failed", zap.String("order_id", orderID), zap.String("code", code), zap.Error(err))
	}
}

func (h *LZTMarketHandler) markOrderFulfilled(ctx context.Context, orderID string, delivery map[string]interface{}) {
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
	if _, err := upd.Save(ctx); err != nil {
		applog.Error("failed to mark order fulfilled", zap.String("order_id", orderID), zap.Error(err))
	}
}

func (h *LZTMarketHandler) getOrderForUser(ctx context.Context, orderID string, userID uint) (publicMarketOrder, bool) {
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
		Only(ctx)
	if err != nil {
		return publicMarketOrder{}, false
	}
	order := mapEntityToPublicMarketOrder(row)
	order.Steps = h.loadOrderSteps(ctx, row.OrderID)
	return order.toClientDTO(true), true
}
