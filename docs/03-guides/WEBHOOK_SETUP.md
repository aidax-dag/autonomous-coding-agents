# GitHub Webhook Setup Guide

> Real-time event processing with GitHub webhooks

**Feature**: F4.2 - GitHub Webhook Support

## Overview

Respond to GitHub events in real-time instead of polling for instant PR and review handling.

**Benefits:**
- Instant response to PR events
- HMAC SHA-256 signature verification
- No unnecessary polling
- Automatic retry and error handling

---

## Quick Start

### 1. Configure Environment

Add to `.env`:

```bash
# GitHub Webhook Support
WEBHOOK_ENABLED=true
WEBHOOK_PORT=3001
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PATH=/webhook
WEBHOOK_SECRET=your-webhook-secret-here
```

**Generate secure secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Start Server

```bash
# Build and start
npm run build
npm run start:agents

# Or for development
npm run dev:health
```

Webhook server starts on `http://0.0.0.0:3001/webhook`

### 3. Configure GitHub Webhook

#### Option A: Public Server

1. Go to repository → **Settings** → **Webhooks** → **Add webhook**
2. Configure:
   - **Payload URL**: `https://your-domain.com:3001/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your `WEBHOOK_SECRET` from `.env`
   - **Events**: Pull requests, Pull request reviews, Pull request review comments
   - **Active**: ✅

#### Option B: Local Development (ngrok)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start ngrok
ngrok http 3001

# Use ngrok HTTPS URL in GitHub webhook
# Payload URL: https://abc123.ngrok.io/webhook
```

#### Option C: GitHub App (Production)

Create a GitHub App for better security and rate limits.

---

## Supported Events

### Pull Request Events

- **opened**: New PR → Triggers code review
- **synchronize**: New commits → Re-triggers review
- **reopened**: PR reopened → Triggers review
- **closed**: PR merged/closed → Sends notification

### Pull Request Review Events

- **submitted**: Review submitted → May trigger auto-fix
- **dismissed**: Review dismissed → May trigger re-review

### Ping Events

- **ping**: Webhook test → Logged for verification

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_ENABLED` | Yes | `false` | Enable/disable webhook server |
| `WEBHOOK_PORT` | No | `3001` | Port for webhook server |
| `WEBHOOK_HOST` | No | `0.0.0.0` | Host to bind (0.0.0.0 for all) |
| `WEBHOOK_PATH` | No | `/webhook` | URL path for webhook |
| `WEBHOOK_SECRET` | Yes* | - | HMAC signature secret |

*Required if `WEBHOOK_ENABLED=true`

---

## Security

### HMAC Verification

All payloads verified using HMAC SHA-256:

```typescript
const signature = req.headers['x-hub-signature-256'];
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmac.update(JSON.stringify(req.body));
const expectedSignature = `sha256=${hmac.digest('hex')}`;

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

### Best Practices

1. **Store Secret Securely**: Use environment variables, not code
2. **HTTPS Required**: Always use HTTPS in production (ngrok provides this)
3. **Rate Limiting**: Consider adding rate limiting for production
4. **Firewall**: Restrict to GitHub IP ranges if possible

Get GitHub webhook IPs: https://api.github.com/meta (see `hooks` field)

---

## Event Processing Flow

```
GitHub Event (PR opened)
  ↓
Webhook Server (port 3001)
  ↓
HMAC Signature Verification
  ↓
Event Type Router
  ↓
ACP MessageBus
  ↓
Agents (Coder/Reviewer/Repo Manager)
```

---

## Testing

### Test Webhook

1. Create a test PR in your repository
2. Check webhook delivery in GitHub:
   - Settings → Webhooks → Recent Deliveries
3. Verify server logs:
   ```bash
   npm run logs
   ```

### Manual Test

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"zen": "test"}'
```

---

## Troubleshooting

### Webhook not receiving events

**Check:**
1. Server is running: `curl http://localhost:3001/webhook`
2. ngrok tunnel active (for local dev)
3. GitHub webhook configured correctly
4. Webhook secret matches

### Signature verification failed

**Check:**
1. `WEBHOOK_SECRET` matches GitHub setting
2. Payload not modified by proxy
3. Check logs for signature mismatch details

### Events not triggering actions

**Check:**
1. ACP MessageBus: Verify agents are initialized (in-process bus)
2. Agents running: `pm2 status`
3. Event type supported (see Supported Events)
4. Check agent logs: `npm run logs`

---

## Webhook Payload Examples

### Pull Request Opened

```json
{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "id": 123,
    "title": "Add authentication",
    "head": { "sha": "abc123" },
    "base": { "ref": "main" }
  }
}
```

### Pull Request Review Submitted

```json
{
  "action": "submitted",
  "review": {
    "id": 456,
    "state": "approved",
    "body": "LGTM!"
  },
  "pull_request": { "number": 42 }
}
```

---

## Advanced

### Custom Event Handlers

Add custom handlers in `src/server/webhook/handlers.ts`:

```typescript
export class WebhookHandlers {
  async handlePullRequest(event: PullRequestWebhookPayload) {
    // Custom logic
  }

  async handleReview(event: PullRequestReviewWebhookPayload) {
    // Custom logic
  }
}
```

### Multiple Repositories

Same webhook server can handle multiple repositories. Configure webhook on each repository with the same endpoint.

### Webhook Logs

Detailed logs in `logs/health-server-*.log`:

```
[WEBHOOK] Received pull_request.opened for owner/repo#42
[WEBHOOK] Signature verified
[WEBHOOK] Published to ACP MessageBus: pr.opened
```

---

## See Also

- [CLI Usage Guide](./CLI_USAGE.md) - CLI commands
- [Interactive Mode](./INTERACTIVE_MODE.md) - Real-time monitoring
- [Deployment Guide](./DEPLOYMENT.md) - Production setup
