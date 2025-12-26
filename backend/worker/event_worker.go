package worker

import (
	"context"
	"time"

	"backend-gin/logger"
	"backend-gin/services"

	"go.uber.org/zap"
)

const (
	// Auto-release check interval
	autoReleaseInterval = 1 * time.Hour

	// Dispute phase escalation check interval
	disputePhaseInterval = 30 * time.Minute
)

// StartEventWorker starts background workers for the wallet system
func StartEventWorker(ctx context.Context) {
	// Start auto-release worker
	go startAutoReleaseWorker(ctx)

	// Start dispute phase escalation worker
	go startDisputePhaseWorker(ctx)

	logger.Info("Background workers started")
}

// startAutoReleaseWorker periodically checks and releases transfers that have passed their hold period
func startAutoReleaseWorker(ctx context.Context) {
	transferService := services.NewTransferService()

	// Run immediately on start
	processAutoRelease(transferService)

	ticker := time.NewTicker(autoReleaseInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("Auto-release worker stopped")
			return
		case <-ticker.C:
			processAutoRelease(transferService)
		}
	}
}

func processAutoRelease(transferService *services.TransferService) {
	count, err := transferService.AutoReleaseExpiredTransfers()
	if err != nil {
		logger.Error("Failed to auto-release transfers", zap.Error(err))
		return
	}

	if count > 0 {
		logger.Info("Auto-released transfers", zap.Int("count", count))
	}
}

// startDisputePhaseWorker periodically checks and escalates disputes with expired phase deadlines
func startDisputePhaseWorker(ctx context.Context) {
	disputeService := services.NewDisputeService()

	// Run immediately on start
	processDisputePhases(disputeService)

	ticker := time.NewTicker(disputePhaseInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("Dispute phase worker stopped")
			return
		case <-ticker.C:
			processDisputePhases(disputeService)
		}
	}
}

func processDisputePhases(disputeService *services.DisputeService) {
	count, err := disputeService.ProcessExpiredPhases()
	if err != nil {
		logger.Error("Failed to process expired dispute phases", zap.Error(err))
		return
	}

	if count > 0 {
		logger.Info("Escalated dispute phases", zap.Int("count", count))
	}
}
