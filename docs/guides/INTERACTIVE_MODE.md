# Interactive Mode Guide

> Real-time monitoring and feedback for autonomous agent tasks

**Feature**: F4.4 - Interactive Feedback System

## Overview

Monitor agent tasks in real-time and provide feedback during development. Guide development direction, approve plans, and make adjustments as agents work.

**Benefits:**
- Real-time agent monitoring
- Direct feedback during development
- Plan approval before implementation
- Pause/resume control
- Full update history

---

## Quick Start

```bash
# 1. Start a task
multi-agent start-project \
  --repo https://github.com/username/my-app \
  --requirements "Build user authentication"

# Output: Task ID: task-1234567890-abc123

# 2. Start interactive mode
multi-agent interactive task-1234567890-abc123
```

### Example Session

```
🤖 Interactive Mode Started

Task ID: task-1234567890-abc123
Type /help for available commands

>

📊 Planning Phase Started
   Creating implementation plan for user authentication

💬 Feedback Requested
   ID: req-001
   Plan Approval Needed

   I plan to implement authentication with:
   - JWT tokens for session management
   - bcrypt for password hashing
   - PostgreSQL for user storage

   Options:
   1. Approve - Proceed with this plan
   2. Modify - Suggest changes
   3. Reject - Start over

> /respond req-001 approve

✓ Response sent for req-001

⏳ Implementation Started [████████░░░░░░░░░░░░] 40%
   Creating database schema

✅ Feature implemented successfully!

> /quit
👋 Interactive session ended
```

---

## Available Commands

### `/help`
Display available commands.

### `/status`
Show current task status and statistics.

```
> /status

Task Status:
  Task ID:          task-1234567890-abc123
  Session uptime:   15m 30s
  Last activity:    5s ago
  Updates received: 42
  Pending feedback: 1
```

### `/pending`
List pending feedback requests.

```
> /pending

Pending Feedback Requests:
  ID: req-002
  Code Review Approval
  Please review the authentication implementation
```

### `/respond <id> <choice> [message]`
Respond to feedback request.

```
# Approve
> /respond req-001 approve

# Modify
> /respond req-001 modify Use Redis for sessions

# Reject
> /respond req-001 reject Doesn't fit our architecture
```

**Choices:** `approve`/`yes`, `modify`/`change`, `reject`/`no`, or custom text

### `/pause` / `/resume`
Pause or resume task execution.

```
> /pause
⏸️  Task paused

> /resume
▶️  Task resumed
```

### `/quit` or `/exit`
Exit interactive mode.

---

## Sending Feedback

### General Feedback

Type any message without `/` prefix:

```
> Can you add rate limiting to the login endpoint?
✓ Feedback sent
```

### Responding to Requests

Use `/respond` when agent requests feedback:

```
💬 Feedback Requested
   ID: req-003
   Direction Change
   Should I implement OAuth2 support now or later?

> /respond req-003 later Let's finish basic auth first
✓ Response sent for req-003
```

---

## Update Types

**Status Changes:**
```
📊 Planning Phase Started
```

**Progress:**
```
⏳ Implementation Started [████████░░░░░░░░░░░░] 40%
```

**Information:**
```
ℹ️  Using PostgreSQL for user storage
```

**Warnings:**
```
⚠️  No tests found for authentication module
```

**Errors:**
```
❌ Build failed: TypeScript compilation error
```

**Success:**
```
✅ All tests passed!
```

---

## Configuration

Uses existing NATS connection from `.env`:

```bash
NATS_URL=nats://localhost:4222
```

**NATS Topics:**
- `task.{taskId}.updates` - Agent updates
- `task.{taskId}.feedback-request` - Feedback requests
- `task.{taskId}.feedback` - User responses
- `task.{taskId}.control` - Control commands

---

## Use Cases

### 1. Plan Approval

```
💬 Feedback Requested: Plan Approval
> /respond req-001 approve
```

### 2. Direction Change

```
💬 Feedback Requested: Technology Choice
   Should I use REST or GraphQL?

> /respond req-002 REST We already have REST infrastructure
```

### 3. Error Resolution

```
❌ Test failed: Invalid token format

> Add proper JWT validation with error handling
✓ Feedback sent
```

### 4. Code Review

```
💬 Feedback Requested: Code Review
   Please review the implementation

> /respond req-003 modify Add input validation and improve error messages
```

---

## Best Practices

**Provide Clear Feedback:**
- Be specific about what to change
- Include reasoning when rejecting
- Use examples when helpful

**Monitor Regularly:**
- Keep interactive mode open during development
- Respond to feedback requests promptly
- Review progress updates

**Use Pause/Resume:**
- Pause before major direction changes
- Resume after clarifying requirements

**Keep History:**
- All updates and feedback are logged
- Review history to understand decisions

---

## Troubleshooting

**No updates appearing:**
- Ensure agents are running (`pm2 status`)
- Check NATS connection (`curl http://localhost:8222/healthz`)
- Verify task ID is correct

**Cannot send feedback:**
- Check NATS connection
- Ensure task is active (not completed)
- Try restarting interactive mode

**Feedback request timeout:**
- Agent may be waiting for response
- Use `/pending` to see all requests
- Respond or pause task to prevent timeout

---

## Advanced

### Multiple Tasks

Run interactive mode in separate terminals for multiple tasks:

```bash
# Terminal 1
multi-agent interactive task-XXX

# Terminal 2
multi-agent interactive task-YYY
```

### Integration with Scripts

Automate responses for testing:

```bash
echo "/respond req-001 approve" | multi-agent interactive task-XXX
```

### Custom Update Handlers

Subscribe to update topics directly for custom processing:

```typescript
await natsClient.subscribe(`task.${taskId}.updates`, (data) => {
  const update = JSON.parse(data);
  // Custom handling
});
```

---

## See Also

- [CLI Usage Guide](./CLI_USAGE.md) - All CLI commands
- [Webhook Setup](./WEBHOOK_SETUP.md) - Real-time GitHub events
