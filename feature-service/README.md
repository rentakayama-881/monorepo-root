# Feature Service - ASP.NET Core + MongoDB

A microservice handling social features (replies, reactions) and finance features (wallets, transfers, withdrawals, disputes) for the Alephdraad platform.

## Architecture

```
Frontend (Next.js/Vercel)
    ├── Core API (Gin) → api.aivalid.id → Neon Postgres
    └── Feature API (ASP.NET Core) → feature.aivalid.id → MongoDB
```

## Features

### Phase 1: Social Service ✅
- **Reply System** - Nested replies with cursor pagination (up to depth 3)
- **Reaction System** - Like, love, fire, sad, laugh reactions for threads & replies

### Phase 2: Finance Service (Structure Only)
- **Wallet Management** - User wallets and transaction history
- **Transfers** - P2P transfers with idempotency
- **Withdrawals** - Bank transfer and e-wallet withdrawals
- **Disputes** - Dispute management system

## Getting Started

### Prerequisites
- .NET 8.0 SDK
- MongoDB 7.0+
- Docker (optional)

### Local Development

1. **Clone and navigate to feature-service:**
   ```bash
   cd feature-service
   ```

2. **Set environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your JWT_SECRET (must match Gin backend)
   ```

3. **Run MongoDB locally:**
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:7.0
   ```

4. **Run the API:**
   ```bash
   cd src/FeatureService.Api
   dotnet run
   ```

   The API will be available at `http://localhost:5000`

5. **View Swagger documentation:**
   Open `http://localhost:5000/swagger` in your browser

### Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f feature-api

# Stop services
docker-compose down
```

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Social Service

#### Replies
- `GET /api/v1/threads/{threadId}/replies` - List replies (cursor pagination)
  - Query params: `cursor`, `limit` (default: 30, max: 100)
- `POST /api/v1/threads/{threadId}/replies` - Create reply
  - Body: `{ "content": "string", "parentReplyId": "rpl_xxx" }`
- `PATCH /api/v1/threads/{threadId}/replies/{replyId}` - Edit reply (author only)
  - Body: `{ "content": "string" }`
- `DELETE /api/v1/threads/{threadId}/replies/{replyId}` - Soft delete (author only)

#### Reactions
- `POST /api/v1/threads/{threadId}/reactions` - Add/update reaction
  - Body: `{ "reactionType": "like" }` (like, love, fire, sad, laugh)
- `DELETE /api/v1/threads/{threadId}/reactions` - Remove reaction
- `GET /api/v1/threads/{threadId}/reactions/summary` - Get reaction counts

### Finance Service (Phase 2 - Coming Soon)
- `GET /api/v1/wallets/me` - Get user wallet (501 Not Implemented)
- `POST /api/v1/wallets/transfers` - Create transfer (501 Not Implemented)
- `POST /api/v1/wallets/withdrawals` - Request withdrawal (501 Not Implemented)
- `POST /api/v1/disputes` - Create dispute (501 Not Implemented)

## Authentication

The service uses JWT tokens issued by the Gin backend. Include the token in requests:

```
Authorization: Bearer <jwt-token>
```

JWT configuration must match the Gin backend:
- Same `JWT_SECRET`
- Same `JWT_ISSUER` (api.aivalid.id)
- Same `JWT_AUDIENCE` (alephdraad-clients)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB__CONNECTIONSTRING` | MongoDB connection string | `mongodb://127.0.0.1:27017` |
| `MONGODB__DATABASENAME` | Database name | `feature_service_db` |
| `JWT__SECRET` | JWT signing secret (required) | - |
| `JWT__ISSUER` | JWT issuer | `api.aivalid.id` |
| `JWT__AUDIENCE` | JWT audience | `alephdraad-clients` |
| `REDIS__CONNECTIONSTRING` | Redis connection string/URL (recommended: `rediss://...`) | - |
| `REDIS__REQUIRETLS` | Require TLS for non-local Redis endpoints | `true` |
| `REDIS__SSLHOST` | Optional TLS SNI/hostname override | - |
| `REDIS__USER` | Optional Redis ACL username | - |
| `REDIS__PASSWORD` | Optional Redis password (if not in connection string) | - |
| `CORS__ALLOWEDORIGINS__0` | Allowed CORS origin | `https://aivalid.id` |
| `ASPNETCORE_URLS` | Service URLs | `http://127.0.0.1:5000` |

### MongoDB Collections & Indexes

#### Social Service Collections
1. **replies** - Thread replies
   - Index: `(threadId, createdAt desc)`
   - Unique: `id`

2. **reactions** - User reactions
   - Unique: `(userId, targetType, targetId)`
   - Index: `(targetType, targetId)`

3. **reaction_counts** - Aggregated reaction counts
   - ID format: `{targetType}:{targetId}`

## Error Response Format

All errors follow a consistent format:

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

### Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `UNAUTHORIZED` - Authentication required or failed
- `NOT_FOUND` - Resource not found
- `INVALID_OPERATION` - Operation not allowed
- `INTERNAL_ERROR` - Server error

## Testing

### Build and Test
```bash
dotnet build
dotnet test
```

### Manual Testing with curl

```bash
# Health check
curl http://localhost:5000/health

# Get replies (no auth required)
curl http://localhost:5000/api/v1/threads/1/replies

# Create reply (requires auth)
curl -X POST http://localhost:5000/api/v1/threads/1/replies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Great post!"}'

# Add reaction (requires auth)
curl -X POST http://localhost:5000/api/v1/threads/1/reactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reactionType": "like"}'
```

## Deployment (VPS)

### Manual Deployment

1. **Install .NET 8.0 Runtime:**
   ```bash
   wget https://dot.net/v1/dotnet-install.sh
   bash dotnet-install.sh --channel 8.0 --runtime aspnetcore
   ```

2. **Build and publish:**
   ```bash
   dotnet publish -c Release -o /opt/feature-service
   ```

3. **Create systemd service** (`/etc/systemd/system/feature-service.service`):
   ```ini
   [Unit]
   Description=Feature Service
   After=network.target

   [Service]
   Type=notify
   WorkingDirectory=/opt/feature-service
   ExecStart=/usr/bin/dotnet /opt/feature-service/FeatureService.Api.dll
   Restart=always
   RestartSec=10
   KillSignal=SIGINT
   SyslogIdentifier=feature-service
   User=www-data
   Environment=ASPNETCORE_ENVIRONMENT=Production
   Environment=ASPNETCORE_URLS=http://127.0.0.1:5000
   EnvironmentFile=/opt/feature-service/.env

   [Install]
   WantedBy=multi-user.target
   ```

4. **Start service:**
   ```bash
   systemctl daemon-reload
   systemctl enable feature-service
   systemctl start feature-service
   systemctl status feature-service
   ```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name feature.alephdraad.fun;

    ssl_certificate /etc/letsencrypt/live/feature.alephdraad.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/feature.alephdraad.fun/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Logs

View logs:
```bash
# systemd service
journalctl -u feature-service -f

# Docker
docker-compose logs -f feature-api
```

## Project Structure

```
feature-service/
├── src/
│   └── FeatureService.Api/
│       ├── Controllers/         # API endpoints
│       │   ├── HealthController.cs
│       │   ├── Social/          # Phase 1
│       │   │   ├── RepliesController.cs
│       │   │   └── ReactionsController.cs
│       │   └── Finance/         # Phase 2 (stubs)
│       ├── Services/            # Business logic
│       ├── Models/Entities/     # MongoDB documents
│       ├── DTOs/                # Request/response models
│       ├── Middleware/          # Custom middleware
│       ├── Infrastructure/      # MongoDB & Auth
│       ├── Validators/          # FluentValidation
│       └── Program.cs           # App startup
├── tests/                       # Unit & integration tests
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## License

MIT
