# Integration Testing Guide

This document provides examples of how to test the Feature Service API endpoints.

## Prerequisites
- Feature Service running (via Docker or directly)
- MongoDB running and accessible
- Valid JWT token from the Gin backend

## Getting a JWT Token

First, authenticate with the Core API (Gin backend) to get a JWT token:

```bash
# Login to get JWT token
curl -X POST https://api.aivalid.fun/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Response will contain access_token
# Save it as TOKEN variable
TOKEN="eyJhbGc..."
```

## Health Check (No Auth Required)

```bash
curl http://localhost:5000/health
# or
curl https://feature.aivalid.fun/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-05T10:00:00Z",
#   "service": "feature-service"
# }
```

## Social Service - Replies

### List Replies (No Auth Required)

```bash
# Get replies for thread ID 1
curl http://localhost:5000/api/v1/threads/1/replies

# With pagination
curl "http://localhost:5000/api/v1/threads/1/replies?limit=10&cursor=2026-01-05T10:00:00.000Z"

# Expected response:
# {
#   "success": true,
#   "data": [
#     {
#       "id": "rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T",
#       "threadId": 1,
#       "userId": 123,
#       "username": "johndoe",
#       "content": "Great post!",
#       "parentReplyId": null,
#       "depth": 0,
#       "isDeleted": false,
#       "createdAt": "2026-01-05T10:00:00Z",
#       "updatedAt": "2026-01-05T10:00:00Z"
#     }
#   ],
#   "meta": {
#     "count": 1,
#     "hasMore": false,
#     "nextCursor": null,
#     "requestId": "req_xyz",
#     "timestamp": "2026-01-05T10:00:00Z"
#   }
# }
```

### Create Reply (Auth Required)

```bash
# Create top-level reply
curl -X POST http://localhost:5000/api/v1/threads/1/replies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is my reply to the thread"
  }'

# Create nested reply (reply to another reply)
curl -X POST http://localhost:5000/api/v1/threads/1/replies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is my reply to your comment",
    "parentReplyId": "rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T"
  }'

# Expected response:
# {
#   "id": "rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T",
#   "threadId": 1,
#   "userId": 123,
#   "username": "johndoe",
#   "content": "This is my reply to the thread",
#   "parentReplyId": null,
#   "depth": 0,
#   "isDeleted": false,
#   "createdAt": "2026-01-05T10:00:00Z",
#   "updatedAt": "2026-01-05T10:00:00Z"
# }
```

### Update Reply (Auth Required, Author Only)

```bash
curl -X PATCH http://localhost:5000/api/v1/threads/1/replies/rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated content for my reply"
  }'
```

### Delete Reply (Auth Required, Author Only)

```bash
curl -X DELETE http://localhost:5000/api/v1/threads/1/replies/rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T \
  -H "Authorization: Bearer $TOKEN"

# Expected: 204 No Content
```

## Social Service - Reactions

### Add/Update Reaction (Auth Required)

```bash
# Add a "like" reaction to thread 1
curl -X POST http://localhost:5000/api/v1/threads/1/reactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reactionType": "like"
  }'

# Change to "love" reaction (updates existing)
curl -X POST http://localhost:5000/api/v1/threads/1/reactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reactionType": "love"
  }'

# Valid reaction types: like, love, fire, sad, laugh

# Expected response:
# {
#   "success": true,
#   "message": "Reaction added successfully",
#   "meta": {
#     "requestId": "req_xyz",
#     "timestamp": "2026-01-05T10:00:00Z"
#   }
# }
```

### Remove Reaction (Auth Required)

```bash
curl -X DELETE http://localhost:5000/api/v1/threads/1/reactions \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "success": true,
#   "message": "Reaction removed successfully",
#   "meta": {
#     "requestId": "req_xyz",
#     "timestamp": "2026-01-05T10:00:00Z"
#   }
# }
```

### Get Reaction Summary (No Auth Required)

```bash
# Get reaction counts for thread 1
curl http://localhost:5000/api/v1/threads/1/reactions/summary

# If authenticated, also shows your reaction
curl http://localhost:5000/api/v1/threads/1/reactions/summary \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "counts": {
#       "like": 42,
#       "love": 18,
#       "fire": 7,
#       "sad": 2,
#       "laugh": 15
#     },
#     "totalCount": 84,
#     "userReaction": "like"  // only if authenticated
#   },
#   "meta": {
#     "requestId": "req_xyz",
#     "timestamp": "2026-01-05T10:00:00Z"
#   }
# }
```

## Finance Service (Phase 2 - Not Yet Implemented)

All finance endpoints currently return 501 Not Implemented:

```bash
# Get wallet (501)
curl http://localhost:5000/api/v1/wallets/me \
  -H "Authorization: Bearer $TOKEN"

# Create transfer (501)
curl -X POST http://localhost:5000/api/v1/wallets/transfers \
  -H "Authorization: Bearer $TOKEN"

# Create withdrawal (501)
curl -X POST http://localhost:5000/api/v1/wallets/withdrawals \
  -H "Authorization: Bearer $TOKEN"

# Create dispute (501)
curl -X POST http://localhost:5000/api/v1/disputes \
  -H "Authorization: Bearer $TOKEN"
```

## Error Responses

All errors follow this consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Content must be between 1 and 5000 characters",
    "details": ["Content is required"]
  },
  "meta": {
    "requestId": "req_xyz789",
    "timestamp": "2026-01-05T10:30:00Z"
  }
}
```

Common error codes:
- `VALIDATION_ERROR` (400) - Input validation failed
- `UNAUTHORIZED` (401) - Authentication required or failed
- `NOT_FOUND` (404) - Resource not found
- `INVALID_OPERATION` (400) - Operation not allowed
- `INTERNAL_ERROR` (500) - Server error

## Testing with Swagger

When running locally, access Swagger UI at:
- http://localhost:5000/swagger

Swagger provides interactive API documentation and testing capabilities.

## Load Testing

Example using `hey` tool:

```bash
# Install hey
go install github.com/rakyll/hey@latest

# Load test replies endpoint (target: 100 req/s)
hey -z 30s -c 10 -q 10 \
  http://localhost:5000/api/v1/threads/1/replies

# Load test with authentication
hey -z 30s -c 10 -q 10 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/threads/1/replies
```

## Docker Testing

```bash
# Start services with docker-compose
cd feature-service
docker-compose up -d

# Check logs
docker-compose logs -f feature-api

# Test health endpoint
curl http://localhost:5000/health

# Stop services
docker-compose down
```
