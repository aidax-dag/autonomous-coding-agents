# GitHub Webhook Setup Guide

> Real-time event processing with GitHub webhooks for instant PR and review handling

**Feature**: F4.2 - GitHub Webhook Support

---

## 📖 Overview

The webhook server allows the system to respond to GitHub events in real-time instead of using polling. This significantly reduces latency and improves responsiveness.

### Benefits

- **⚡ Real-time**: Instant response to PR events (opened, updated, merged)
- **🔒 Secure**: HMAC SHA-256 signature verification
- **📊 Efficient**: No unnecessary polling, reduced API calls
- **🎯 Reliable**: Automatic retry and error handling

---

## 🚀 Quick Start

### 1. Configure Environment Variables

Add the following to your `.env` file:

```bash
# GitHub Webhook Support (Feature F4.2)
WEBHOOK_ENABLED=true
WEBHOOK_PORT=3001
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PATH=/webhook
WEBHOOK_SECRET=your-webhook-secret-here
```

**Important**: Generate a strong random secret:

```bash
# Generate a secure webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Start the Health Server (includes webhook server)

```bash
# Build the project
npm run build

# Start with PM2
npm run start:agents

# Or for development
npm run dev:health
```

The webhook server will start on `http://0.0.0.0:3001/webhook` (or your configured port).

### 3. Configure GitHub Webhook

#### Option A: Public Server

If your server is publicly accessible:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `https://your-domain.com:3001/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your `WEBHOOK_SECRET` from `.env`
   - **Events**: Select individual events:
     - ✅ Pull requests
     - ✅ Pull request reviews
     - ✅ Pull request review comments
   - **Active**: ✅ Checked

#### Option B: Local Development with ngrok

For local development, use ngrok to expose your webhook server:

```bash
# Install ngrok (if not installed)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start ngrok
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

Then configure GitHub webhook with:
- **Payload URL**: `https://abc123.ngrok.io/webhook`

#### Option C: GitHub App

For production deployments, consider creating a GitHub App for better security and rate limits.

---

## 📋 Supported Events

### Pull Request Events

Triggers when a PR is:
- **opened**: New PR created → Triggers code review
- **synchronize**: New commits pushed → Re-triggers code review
- **reopened**: PR reopened → Triggers code review
- **closed**: PR closed/merged → Sends notification

### Pull Request Review Events

Triggers when a review is:
- **submitted**: Review submitted → May trigger auto-fix (if changes requested)
- **dismissed**: Review dismissed → May trigger re-review

### Ping Events

- **ping**: Webhook connection test → Logged for verification

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_ENABLED` | Yes | `false` | Enable/disable webhook server |
| `WEBHOOK_PORT` | No | `3001` | Port for webhook server |
| `WEBHOOK_HOST` | No | `0.0.0.0` | Host to bind to (0.0.0.0 for all interfaces) |
| `WEBHOOK_PATH` | No | `/webhook` | URL path for webhook endpoint |
| `WEBHOOK_SECRET` | Yes* | - | Secret for HMAC signature verification |

*Required if `WEBHOOK_ENABLED=true`

### Security Considerations

1. **HMAC Verification**: All webhook payloads are verified using HMAC SHA-256
2. **Secret Storage**: Store `WEBHOOK_SECRET` securely (use environment variables, not code)
3. **HTTPS Required**: Always use HTTPS in production (ngrok provides this for dev)
4. **Rate Limiting**: Consider adding rate limiting for production deployments
5. **Firewall**: Restrict webhook endpoint to GitHub IP ranges if possible

### GitHub IP Ranges

For enhanced security, you can whitelist GitHub webhook IPs:
https://api.github.com/meta (see `hooks` field)

---

## 🧪 Testing the Webhook

### 1. Test with GitHub Ping

After configuring the webhook in GitHub:
1. Click **"Recent Deliveries"** in GitHub webhook settings
2. Click **"Redeliver"** on a ping event
3. Check your logs:

```bash
# Using PM2
pm2 logs health-server

# Or check the output directly
tail -f logs/health-server.log
```

You should see:
```
[Webhook] Received ping event { zen: "...", hookId: 123456 }
```

### 2. Test with a Real PR

1. Create a test PR in your repository
2. Check logs for:
```
[Webhook] Webhook event received { type: 'pull_request', deliveryId: '...' }
[Webhook] Processing pull request event { action: 'opened', pr: 123 }
[Webhook] Review task published { taskId: '...', pr: 123 }
```

### 3. Manual Testing with curl

```bash
# Generate HMAC signature
PAYLOAD='{"zen":"test","hook_id":123,"hook":{"type":"Repository","id":123,"name":"web","active":true,"events":["pull_request"],"config":{"content_type":"json","url":"http://localhost:3001/webhook"},"created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"},"repository":{"id":1,"name":"test","full_name":"user/test","owner":{"login":"user","id":1,"type":"User"},"private":false,"html_url":"https://github.com/user/test","description":"","fork":false,"default_branch":"main"},"sender":{"login":"user","id":1,"type":"User"}}'

SECRET="your-webhook-secret-here"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send webhook
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected response:
```json
{"status":"received","eventId":"..."}
```

---

## 📊 Monitoring

### Health Check Endpoint

Check webhook server status:

```bash
curl http://localhost:3000/health
```

Response includes webhook status:

```json
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2024-11-15T10:00:00.000Z",
  "services": {
    "nats": { "connected": true },
    "webhook": {
      "enabled": true,
      "port": 3001
    }
  }
}
```

### Detailed Webhook Stats

```bash
curl http://localhost:3000/health/detailed
```

Response includes:

```json
{
  "services": {
    "webhook": {
      "running": true,
      "port": 3001,
      "eventsReceived": 42,
      "eventsProcessed": 40,
      "eventsFailed": 2,
      "lastEventAt": "2024-11-15T10:00:00.000Z",
      "uptime": 3600000
    }
  }
}
```

### Logging

Webhook events are logged with structured data:

```typescript
// Example log output
{
  level: 'info',
  message: 'Webhook event received',
  type: 'pull_request',
  action: 'opened',
  pr: 123,
  repo: 'owner/repo',
  deliveryId: 'abc-123',
  timestamp: '2024-11-15T10:00:00.000Z'
}
```

---

## 🐛 Troubleshooting

### Webhook Not Receiving Events

1. **Check if webhook server is running**:
   ```bash
   curl http://localhost:3001/webhook
   # Should return 404 (path exists but requires POST)
   ```

2. **Check firewall/network**:
   - Ensure port 3001 is open
   - For local dev, verify ngrok is running
   - Check GitHub can reach your server

3. **Verify GitHub webhook configuration**:
   - Payload URL is correct
   - Content type is `application/json`
   - Events are selected
   - Webhook is active

### Invalid Signature Errors

```
[Webhook] Invalid webhook signature
```

**Solution**: Ensure `WEBHOOK_SECRET` in `.env` matches GitHub webhook secret

### Events Not Processing

1. **Check NATS connection**:
   ```bash
   curl http://localhost:3000/health
   # Check nats.connected: true
   ```

2. **Check agent subscriptions**:
   - Ensure ReviewerAgent is running and subscribed to tasks
   - Check agent logs for subscription confirmations

3. **Verify event payload**:
   - Check GitHub webhook "Recent Deliveries" for payload
   - Verify payload matches expected schema

### High Failure Rate

Check logs for specific errors:

```bash
pm2 logs health-server | grep "ERROR"
```

Common issues:
- NATS connection failures
- Schema validation errors
- Handler exceptions

---

## 🔄 Migration from Polling

If you were using polling before:

1. Set `WEBHOOK_ENABLED=true` in `.env`
2. Configure GitHub webhook as described above
3. Restart the health server: `pm2 restart health-server`
4. The system will automatically use webhooks instead of polling
5. You can disable polling in ReviewerAgent if desired

---

## 📚 Additional Resources

- [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
- [GitHub Webhook Events](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads)
- [ngrok Documentation](https://ngrok.com/docs)
- [HMAC Signature Verification](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)

---

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review logs: `pm2 logs health-server`
3. Open an issue on GitHub with:
   - Webhook configuration (sanitize secrets!)
   - Error logs
   - Steps to reproduce
