package services

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/logger"

	"go.uber.org/zap"
)

// OwnerResponseSLAWorker periodically enforces owner-response SLA reminders and timeout freeze.
type OwnerResponseSLAWorker struct {
	workflow *EntValidationCaseWorkflowService
	ticker   *time.Ticker
	stopCh   chan struct{}
	doneCh   chan struct{}
	started  bool
}

func NewOwnerResponseSLAWorker(workflow *EntValidationCaseWorkflowService) *OwnerResponseSLAWorker {
	return &OwnerResponseSLAWorker{
		workflow: workflow,
		stopCh:   make(chan struct{}),
		doneCh:   make(chan struct{}),
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
		for {
			select {
			case <-w.ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				reminders, timeouts, err := w.workflow.ProcessOwnerResponseSLA(ctx)
				cancel()
				if err != nil {
					logger.Warn("Owner-response SLA worker iteration failed", zap.Error(err))
					continue
				}
				if reminders > 0 || timeouts > 0 {
					logger.Info("Owner-response SLA worker applied updates",
						zap.Int("reminders", reminders),
						zap.Int("timeouts", timeouts),
					)
				}
			case <-w.stopCh:
				if w.ticker != nil {
					w.ticker.Stop()
				}
				return
			}
		}
	}()
}

func (w *OwnerResponseSLAWorker) Stop() {
	if w == nil || !w.started {
		return
	}
	close(w.stopCh)
	<-w.doneCh
}
