# Email Configuration Guide

This document provides detailed information about email configuration for the AIValid platform using Resend API.

---

## 📧 Overview

AIValid uses [Resend](https://resend.com) as the email service provider for:
- Email verification during registration
- Password reset emails
- System notifications

### Architecture

```
User Registration → Email Queue (3 workers) → Resend API → User Inbox
     ↓                      ↓                      ↓
  Token Gen            Async Processing      Email Delivery
```

**Key Features:**
- ✅ Asynchronous email sending via worker queue
- ✅ Automatic retry mechanism (3 retries with exponential backoff)
- ✅ Queue monitoring and logging
- ✅ Graceful degradation (dev mode without API key)

---

## 🔧 Configuration

### Environment Variables

```bash
# Required for production
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional (recommended for better deliverability)
RESEND_FROM_NAME=AIValid

# Required for email links
FRONTEND_BASE_URL=https://yourdomain.com
```

### Getting Started with Resend

1. **Sign up** at [resend.com](https://resend.com)
2. **Verify your domain**:
   - Add your sending domain in Resend dashboard
   - Configure DNS records (SPF, DKIM, DMARC)
   - Wait for verification (usually takes a few minutes)
3. **Generate API key**:
   - Go to API Keys section
   - Create a new API key
   - Copy the key (starts with `re_`)
4. **Set environment variables** in your deployment

---

## 🎯 Sender Configuration

### Why Sender Name Matters

**Problem**: Email without proper sender name configuration can:
- Show blank profile picture
- Be marked as spam
- Have inconsistent display across email clients
- Reduce user trust

**Solution**: Always set `RESEND_FROM_NAME`

### Email Format

The system automatically formats sender as:
```
"Display Name <email@domain.com>"
```

**Examples:**
```bash
# ✅ Good - Full configuration
RESEND_FROM_NAME=AIValid
RESEND_FROM_EMAIL=noreply@aivalid.id
# Results in: "AIValid <noreply@aivalid.id>"

# ⚠️ Acceptable - Using default name
RESEND_FROM_EMAIL=noreply@aivalid.id
# Results in: "AIValid <noreply@aivalid.id>" (uses default)

# ❌ Bad - Using test email in production
RESEND_FROM_EMAIL=onboarding@resend.dev
# Results in inconsistent sender display
```

---

## 📊 Email Queue System

### Queue Configuration

- **Workers**: 3 concurrent workers
- **Buffer**: 1000 emails
- **Retry**: 3 attempts with exponential backoff
- **Retry Delay**: 5s, 10s, 15s

### Monitoring

Check logs for email queue activity:

```log
[EmailQueue] Started with 3 workers
[EmailQueue] Job enqueued for user@example.com (type: 0)
[EmailQueue] Worker 1: Processing job for user@example.com (queued for 45ms)
[EmailQueue] Worker 1: ✓ Successfully sent email to user@example.com (API call: 892ms, Total: 937ms)
```

### Performance Expectations

| Metric | Expected | Action if Exceeded |
|--------|----------|-------------------|
| Queue time | < 1s | Check worker count |
| API call time | < 2s | Check Resend API status |
| Total time | < 3s | Investigate both queue and API |
| Queue delay warning | > 5s | Review logs for bottlenecks |

### Warning Indicators

```log
# ⚠️ Queue delay warning
[EmailQueue] WARNING: Worker 2: Job for user@example.com was queued for 6.2s (longer than expected)

# ✗ Failed attempt
[EmailQueue] Worker 1: ✗ Failed to send email to user@example.com: API error (took 1.2s)

# ✗✗ All retries exhausted
[EmailQueue] Worker 1: ✗✗ All retries exhausted for user@example.com (total time: 45s)
```

---

## 🐛 Troubleshooting

### Issue: Delayed Email Delivery

**Symptoms:**
- User reports not receiving email immediately
- Long delay between registration and email arrival
- Queue logs show normal processing times

**Possible Causes & Solutions:**

1. **Email provider delays** (most common)
   - Check recipient's email provider (Gmail, Outlook, etc.)
   - Some providers have built-in delays for new senders
   - **Solution**: Warm up your sending domain gradually

2. **Spam filtering**
   - Email is delivered but goes to spam folder
   - **Solution**: 
     - Verify domain properly (SPF, DKIM, DMARC)
     - Set `RESEND_FROM_NAME`
     - Avoid spammy content in emails

3. **Queue bottleneck**
   - Check logs for "WARNING: queued for > 5s"
   - **Solution**: Increase worker count in `main.go`:
     ```go
     utils.InitEmailQueue(5) // Increase from 3 to 5
     ```

4. **Resend API issues**
   - Check Resend status page
   - Review API response times in logs
   - **Solution**: Contact Resend support

### Issue: Missing Sender Profile Picture

**Symptom**: Email shows blank avatar or inconsistent display

**Solution**:
1. Set `RESEND_FROM_NAME` environment variable
2. Verify sending domain in Resend
3. Ensure `RESEND_FROM_EMAIL` uses verified domain

### Issue: Emails Going to Spam

**Solutions**:
1. **Domain Authentication**:
   ```bash
   # Add these DNS records (get from Resend dashboard)
   TXT  @  "v=spf1 include:resend.com ~all"
   TXT  resend._domainkey  "v=DKIM1; k=rsa; p=..."
   TXT  _dmarc  "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
   ```

2. **Sender Configuration**:
   - Use professional sender name
   - Use verified domain email
   - Add Reply-To header (automatically configured)

3. **Content Quality**:
   - Avoid spammy keywords
   - Use proper HTML structure
   - Include unsubscribe option (if applicable)

### Issue: Development Mode Not Working

**Symptom**: No emails in development, no logs

**Solution**:
1. Check that `RESEND_API_KEY` is NOT set (or empty)
2. Look for dev mode logs:
   ```log
   [DEV MODE] Email verification requested for user@example.com
   ```
3. If missing, check log level configuration

---

## 🔍 Monitoring & Debugging

### Log Levels

```go
// Info - Normal operation
log.Printf("[EmailQueue] Started with 3 workers")
log.Printf("Verification email sent to user@example.com (ID: abc123, From: AIValid <noreply@domain.com>)")

// Warning - Potential issues
log.Printf("[EmailQueue] WARNING: Worker 1: Job was queued for 6s")
log.Printf("Failed to queue verification email: queue is full")

// Error - Failed operations
log.Printf("[EmailQueue] Worker 1: ✗ Failed to send email: API error")
log.Printf("[EmailQueue] Worker 1: ✗✗ All retries exhausted")
```

### Key Metrics to Monitor

1. **Queue Performance**:
   - Average queue time
   - Number of retries
   - Failed emails count

2. **API Performance**:
   - Average API response time
   - API error rate
   - Rate limit hits

3. **User Experience**:
   - Time from registration to email receipt
   - Email open rates
   - Spam complaints

### Debugging Commands

```bash
# Check email queue status in logs
grep "EmailQueue" logs/app.log

# Find failed emails
grep "✗" logs/app.log | grep EmailQueue

# Check queue delays
grep "WARNING.*queued for" logs/app.log

# Monitor API performance
grep "API call:" logs/app.log | grep "sent email"
```

---

## 🚀 Best Practices

### Production Deployment

1. ✅ **Always set sender name**:
   ```bash
   RESEND_FROM_NAME=AIValid
   ```

2. ✅ **Use verified domain**:
   - Don't use `onboarding@resend.dev` in production
   - Verify your own domain

3. ✅ **Configure DNS properly**:
   - SPF record
   - DKIM keys
   - DMARC policy

4. ✅ **Monitor queue performance**:
   - Set up alerts for queue delays > 10s
   - Track failed email rate

5. ✅ **Test email deliverability**:
   - Use [Mail Tester](https://www.mail-tester.com/)
   - Test with multiple email providers

### Domain Warming

When using a new sending domain:
1. Start with low volume (< 100 emails/day)
2. Gradually increase over 2-4 weeks
3. Monitor spam complaints and bounces
4. Maintain consistent sending patterns

### Email Content Guidelines

1. **Clear subject lines** - Avoid spam triggers
2. **Professional HTML** - Use proper structure
3. **Include plain text** - Better deliverability
4. **Add unsubscribe link** - Better reputation
5. **Test across clients** - Gmail, Outlook, Apple Mail

---

## 📚 References

- [Resend Documentation](https://resend.com/docs)
- [Resend Go SDK](https://github.com/resend/resend-go)
- [Email Deliverability Best Practices](https://resend.com/docs/knowledge-base/deliverability)
- [SPF, DKIM, DMARC Setup](https://resend.com/docs/knowledge-base/authentication)

---

## 🔄 Code Reference

**Email Sending**: `backend/utils/email.go`
```go
func SendVerificationEmail(recipientEmail, verificationToken string) error
```

**Email Queue**: `backend/utils/email_queue.go`
```go
func QueueVerificationEmail(recipientEmail, verificationToken string) error
```

**Queue Initialization**: `backend/main.go`
```go
utils.InitEmailQueue(3) // 3 workers
defer utils.GetEmailQueue().Shutdown()
```

---

## ⚡ Quick Reference

```bash
# Minimum production configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=AIValid
FRONTEND_BASE_URL=https://yourdomain.com

# Development (no actual emails sent)
# RESEND_API_KEY=  # Leave empty or unset
FRONTEND_BASE_URL=http://localhost:3000
```

---

**Last Updated**: January 2025  
**Version**: 1.0.0
