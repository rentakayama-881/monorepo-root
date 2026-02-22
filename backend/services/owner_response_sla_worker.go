package services

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/logger"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

const slaWorkerLockKey = "sla_worker_lock"
const slaWorkerLockTTL = 60 * time.Second

// OwnerResponseSLAWorker periodically enforces owner-response SLA reminders and timeout freeze.
// Uses Redis distributed lock to prevent duplicate processing across multiple instances.
type OwnerResponseSLAWorker struct {
	workflow   *EntValidationCaseWorkflowService
	ticker     *time.Ticker
	stopCh     chan struct{}
	doneCh     chan struct{}
	started    bool
	instanceID string
}

func NewOwnerResponseSLAWorker(workflow *EntValidationCaseWorkflowService) *OwnerResponseSLAWorker {
	return &OwnerResponseSLAWorker{
		workflow:   workflow,
		stopCh:     make(chan struct{}),
		doneCh:     make(chan struct{}),
		instanceID: uuid.New().String(),
	}
}

func ownerResponseSLAInterval() time.Duration {
	const fallback = time.Minute
	raw := strings.TrimSpace(os.Getenv("OWNER_RESPONSE_SLA_TICK_SECONDS"))
	if raw == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return fallback
	}
	if seconds < 15 {
		seconds = 15
	}
	return time.Duration(seconds) * time.Second
}

func (w *OwnerResponseSLAWorker) Start() {
	if w == nil || w.started || w.workflow == nil {
		return
	}
	w.started = true
	w.ticker = time.NewTicker(ownerResponseSLAInterval())

	go func() {
		defer close(w.doneCh)
		w.runIteration()
		for {
			select {
			case <-w.ticker.C:
				w.runIteration()
			case <-w.stopCh:
				if w.ticker != nil {
					w.ticker.Stop()
				}
				return
			}
		}
	}()
}

func (w *OwnerResponseSLAWorker) runIteration() {
	// Acquire distributed lock to prevent duplicate processing across instances
	lockCtx, lockCancel := context.WithTimeout(context.Background(), 5*time.Second)
	acquired, err := AcquireLock(lockCtx, slaWorkerLockKey, slaWorkerLockTTL)
	lockCancel()
	if err != nil {
		logger.Warn("SLA worker failed to check distributed lock", zap.Error(err))
		return
	}
	if !acquired {
		logger.Debug("SLA worker skipping iteration: another instance holds the lock",
			zap.String("instance_id", w.instanceID))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	reminders, timeouts, err := w.workflow.ProcessOwnerResponseSLA(ctx)
	cancel()

	// Release lock after processing
	releaseCtx, releaseCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = ReleaseLock(releaseCtx, slaWorkerLockKey)
	releaseCancel()

	if err != nil {
		logger.Warn("Owner-response SLA worker iteration failed", zap.Error(err))
		return
	}
	if reminders > 0 || timeouts > 0 {
		logger.Info("Owner-response SLA worker applied updates",
			zap.Int("reminders", reminders),
			zap.Int("timeouts", timeouts),
		)
	}
}

func (w *OwnerResponseSLAWorker) Stop() {
	if w == nil || !w.started {
		return
	}
	close(w.stopCh)
	<-w.doneCh
}
