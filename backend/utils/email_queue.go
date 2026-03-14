package utils

import (
	"context"
	"fmt"
	"sync"
	"time"

	"backend-gin/logger"
	"go.uber.org/zap"
)

// EmailType represents the type of email to send
type EmailType int

const (
	EmailTypeVerification EmailType = iota
	EmailTypePasswordReset
)

// EmailJob represents an email job to be processed
type EmailJob struct {
	Type      EmailType
	Recipient string
	Token     string
	Retries   int
	CreatedAt time.Time
}

// EmailQueue handles async email sending with retry mechanism
type EmailQueue struct {
	jobs       chan EmailJob
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
	maxRetries int
	retryDelay time.Duration
}

// Global email queue instance
var (
	globalEmailQueue *EmailQueue
	emailQueueOnce   sync.Once
)

// InitEmailQueue initializes the global email queue with specified worker count
func InitEmailQueue(workerCount int) {
	emailQueueOnce.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		globalEmailQueue = &EmailQueue{
			jobs:       make(chan EmailJob, 1000), // Buffer up to 1000 emails
			ctx:        ctx,
			cancel:     cancel,
			maxRetries: 3,
			retryDelay: 5 * time.Second,
		}

		// Start workers
		for i := 0; i < workerCount; i++ {
			globalEmailQueue.wg.Add(1)
			go globalEmailQueue.worker(i)
		}

		logger.Info("email queue started", zap.Int("workers", workerCount))
	})
}

// GetEmailQueue returns the global email queue instance
func GetEmailQueue() *EmailQueue {
	if globalEmailQueue == nil {
		// Auto-initialize with 2 workers if not initialized
		InitEmailQueue(2)
	}
	return globalEmailQueue
}

// Enqueue adds an email job to the queue
func (q *EmailQueue) Enqueue(job EmailJob) error {
	job.CreatedAt = time.Now()
	job.Retries = 0

	select {
	case q.jobs <- job:
		logger.Info("email job enqueued", zap.String("recipient", job.Recipient), zap.Int("type", int(job.Type)))
		return nil
	default:
		logger.Warn("email queue full, dropping job", zap.String("recipient", job.Recipient))
		return fmt.Errorf("email queue is full")
	}
}

// worker processes email jobs from the queue
func (q *EmailQueue) worker(id int) {
	defer q.wg.Done()

	for {
		select {
		case <-q.ctx.Done():
			logger.Info("email worker shutting down", zap.Int("worker_id", id))
			return
		case job := <-q.jobs:
			q.processJob(id, job)
		}
	}
}

// processJob processes a single email job with retry logic
func (q *EmailQueue) processJob(workerID int, job EmailJob) {
	var err error
	queueDuration := time.Since(job.CreatedAt)
	
	if queueDuration > 5*time.Second {
		logger.Warn("email job queued longer than expected",
			zap.Int("worker_id", workerID), zap.String("recipient", job.Recipient), zap.Duration("queue_duration", queueDuration))
	} else {
		logger.Info("processing email job",
			zap.Int("worker_id", workerID), zap.String("recipient", job.Recipient), zap.Duration("queue_duration", queueDuration))
	}

	for attempt := 0; attempt <= q.maxRetries; attempt++ {
		if attempt > 0 {
			logger.Info("retrying email send",
				zap.Int("worker_id", workerID), zap.Int("attempt", attempt), zap.String("recipient", job.Recipient))
			time.Sleep(q.retryDelay * time.Duration(attempt))
		}

		startTime := time.Now()
		switch job.Type {
		case EmailTypeVerification:
			err = sendVerificationEmailDirect(job.Recipient, job.Token)
		case EmailTypePasswordReset:
			err = sendPasswordResetEmailDirect(job.Recipient, job.Token)
		default:
			logger.Error("unknown email type", zap.Int("worker_id", workerID), zap.Int("type", int(job.Type)))
			return
		}
		sendDuration := time.Since(startTime)

		if err == nil {
			totalDuration := time.Since(job.CreatedAt)
			logger.Info("email sent successfully",
				zap.Int("worker_id", workerID), zap.String("recipient", job.Recipient),
				zap.Duration("api_call", sendDuration), zap.Duration("total", totalDuration))
			return
		}

		logger.Warn("email send failed",
			zap.Int("worker_id", workerID), zap.String("recipient", job.Recipient),
			zap.Error(err), zap.Duration("duration", sendDuration))
	}

	// All retries exhausted
	totalDuration := time.Since(job.CreatedAt)
	logger.Error("email dead letter — all retries exhausted",
		zap.Int("worker_id", workerID), zap.Int("max_retries", q.maxRetries),
		zap.String("recipient", job.Recipient), zap.Int("type", int(job.Type)),
		zap.Duration("total_time", totalDuration), zap.Error(err))
}

// Shutdown gracefully shuts down the email queue
func (q *EmailQueue) Shutdown() {
	logger.Info("email queue shutting down")
	q.cancel()
	q.wg.Wait()
	logger.Info("email queue shutdown complete")
}

// QueueVerificationEmail adds a verification email to the queue
func QueueVerificationEmail(recipientEmail, verificationToken string) error {
	return GetEmailQueue().Enqueue(EmailJob{
		Type:      EmailTypeVerification,
		Recipient: recipientEmail,
		Token:     verificationToken,
	})
}

// QueuePasswordResetEmail adds a password reset email to the queue
func QueuePasswordResetEmail(recipientEmail, resetToken string) error {
	return GetEmailQueue().Enqueue(EmailJob{
		Type:      EmailTypePasswordReset,
		Recipient: recipientEmail,
		Token:     resetToken,
	})
}

// sendVerificationEmailDirect is the actual email sending implementation
// This is called by the worker and handles the actual Resend API call
func sendVerificationEmailDirect(recipientEmail, verificationToken string) error {
	// Delegate to existing synchronous implementation
	return SendVerificationEmail(recipientEmail, verificationToken)
}

// sendPasswordResetEmailDirect is the actual email sending implementation
func sendPasswordResetEmailDirect(recipientEmail, resetToken string) error {
	// Delegate to existing synchronous implementation
	return SendPasswordResetEmail(recipientEmail, resetToken)
}
