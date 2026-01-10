package utils

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
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

		log.Printf("[EmailQueue] Started with %d workers", workerCount)
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
		log.Printf("[EmailQueue] Job enqueued for %s (type: %d)", job.Recipient, job.Type)
		return nil
	default:
		// Queue is full
		log.Printf("[EmailQueue] Queue full, dropping job for %s", job.Recipient)
		return fmt.Errorf("email queue is full")
	}
}

// worker processes email jobs from the queue
func (q *EmailQueue) worker(id int) {
	defer q.wg.Done()

	for {
		select {
		case <-q.ctx.Done():
			log.Printf("[EmailQueue] Worker %d shutting down", id)
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
	log.Printf("[EmailQueue] Worker %d: Processing job for %s (queued for %v)", workerID, job.Recipient, queueDuration)

	for attempt := 0; attempt <= q.maxRetries; attempt++ {
		if attempt > 0 {
			log.Printf("[EmailQueue] Worker %d: Retry %d for %s", workerID, attempt, job.Recipient)
			time.Sleep(q.retryDelay * time.Duration(attempt)) // Exponential backoff
		}

		startTime := time.Now()
		switch job.Type {
		case EmailTypeVerification:
			err = sendVerificationEmailDirect(job.Recipient, job.Token)
		case EmailTypePasswordReset:
			err = sendPasswordResetEmailDirect(job.Recipient, job.Token)
		default:
			log.Printf("[EmailQueue] Worker %d: Unknown email type %d", workerID, job.Type)
			return
		}
		sendDuration := time.Since(startTime)

		if err == nil {
			log.Printf("[EmailQueue] Worker %d: Successfully sent email to %s (API call took %v)", workerID, job.Recipient, sendDuration)
			return
		}

		log.Printf("[EmailQueue] Worker %d: Failed to send email to %s: %v (took %v)", workerID, job.Recipient, err, sendDuration)
	}

	// All retries exhausted
	log.Printf("[EmailQueue] Worker %d: All retries exhausted for %s", workerID, job.Recipient)
	// TODO: Add dead letter queue or alerting here
}

// Shutdown gracefully shuts down the email queue
func (q *EmailQueue) Shutdown() {
	log.Println("[EmailQueue] Shutting down...")
	q.cancel()
	q.wg.Wait()
	log.Println("[EmailQueue] Shutdown complete")
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
