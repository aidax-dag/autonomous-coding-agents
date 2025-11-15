# Interactive Mode Guide

> Real-time monitoring and feedback for autonomous agent tasks

**Feature**: F4.4 - Interactive Feedback System

---

## 📖 Overview

Interactive Mode allows you to monitor agent tasks in real-time and provide feedback during development. This enables you to guide the direction of development, approve plans, and make adjustments as needed.

### Benefits

- **📊 Real-time Monitoring**: See what agents are doing as they work
- **💬 Direct Feedback**: Provide guidance and corrections during development
- **⚡ Quick Adjustments**: Modify direction without waiting for completion
- **🎯 Better Control**: Approve plans before implementation begins
- **📝 Full History**: Track all updates and feedback throughout the task

---

## 🚀 Quick Start

### Starting Interactive Mode

```bash
# Start a task first
multi-agent start-project \
  --repo https://github.com/username/my-app \
  --requirements "Build a user authentication system"

# Output includes task ID:
# Task ID: task-1234567890-abc123

# Start interactive mode for that task
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
   3. Reject - Start over with different approach

   Reply with: /respond req-001 <choice> [message]

> /respond req-001 approve

✓ Response sent for req-001

⏳ Implementation Started [████████░░░░░░░░░░░░] 40%
   Creating database schema

✅ Feature implemented successfully!
```

---

## 📋 Available Commands

### `/help`
Display available commands and usage information.

```
> /help
```

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
List all pending feedback requests.

```
> /pending

Pending Feedback Requests:

  ID: req-002
  Code Review Approval
  Please review the authentication implementation
```

### `/respond <id> <choice> [message]`
Respond to a specific feedback request.

```
# Approve a request
> /respond req-001 approve

# Suggest modifications
> /respond req-001 modify Please use Redis instead of PostgreSQL for sessions

# Reject a proposal
> /respond req-001 reject This approach doesn't fit our architecture
```

**Choice options:**
- `approve` / `yes` - Accept and proceed
- `modify` / `change` - Request changes (include message with details)
- `reject` / `no` - Decline and start over
- Any custom text - Provide specific instructions

### `/pause`
Pause task execution temporarily.

```
> /pause
⏸️  Task paused
```

### `/resume`
Resume paused task execution.

```
> /resume
▶️  Task resumed
```

### `/quit` or `/exit`
Exit interactive mode.

```
> /quit
👋 Interactive session ended
```

---

## 💬 Sending Feedback

### General Feedback

Type any message (without `/` prefix) to send general feedback to the agent:

```
> Can you add rate limiting to the login endpoint?
✓ Feedback sent
```

### Responding to Requests

When an agent requests feedback, use `/respond`:

```
💬 Feedback Requested
   ID: req-003
   Direction Change
   Should I implement OAuth2 support now or later?

> /respond req-003 later Let's finish basic auth first
✓ Response sent for req-003
```

---

## 📊 Update Types

Interactive mode displays different types of updates:

### Status Changes
```
📊 Planning Phase Started
   Creating implementation plan
```

### Progress Updates
```
⏳ Implementation Started [████████░░░░░░░░░░░░] 40%
   Creating database schema
```

### Information
```
ℹ️  Using PostgreSQL for user storage
```

### Warnings
```
⚠️  No tests found for authentication module
```

### Errors
```
❌ Build failed: TypeScript compilation error
```

### Success
```
✅ All tests passed!
```

---

## 🔧 Configuration

### Environment Variables

No special configuration needed. Interactive mode uses your existing NATS connection:

```bash
# .env
NATS_URL=nats://localhost:4222
```

### NATS Topics

Interactive mode subscribes to these topics:

- `task.{taskId}.updates` - Agent status updates
- `task.{taskId}.feedback-request` - Feedback requests from agents
- `task.{taskId}.control` - Control messages (pause/resume)

And publishes to:

- `task.{taskId}.feedback` - User feedback responses

---

## 🎯 Use Cases

### 1. Plan Approval

```
💬 Feedback Requested
   Plan Approval Needed

   Implementation plan for user authentication:
   1. Create User model and database schema
   2. Implement registration endpoint
   3. Implement login endpoint with JWT
   4. Add password reset functionality

> /respond req-001 approve
```

### 2. Direction Changes

```
> Can you also add email verification before allowing login?
✓ Feedback sent

📊 Plan Updated
   Adding email verification step
```

### 3. Error Resolution

```
❌ Build failed: Missing dependency 'jsonwebtoken'

💬 Feedback Requested
   How should I proceed?
   1. Install jsonwebtoken
   2. Use a different library
   3. Implement JWT manually

> /respond req-002 1
✓ Response sent

✅ Dependency installed successfully
```

### 4. Real-time Monitoring

```
⏳ Running tests [████████████████████] 100%
   245 tests passed, 0 failed

⏳ Building project [██████████░░░░░░░░░░] 50%
   Compiling TypeScript files

✅ Build completed successfully!
```

---

## 💡 Best Practices

### 1. Monitor Critical Phases

Start interactive mode for important tasks:
- New feature implementation
- Complex refactoring
- Architecture changes
- Production deployments

### 2. Provide Clear Feedback

Be specific in your feedback:

```
❌ Too vague:
> Change it

✅ Clear:
> Please use SHA-256 instead of MD5 for hashing
```

### 3. Respond Promptly

Some feedback requests may have timeouts. Respond quickly to avoid delays:

```
💬 Feedback Requested (expires in 5 minutes)
   ...
```

### 4. Review Plans Before Approval

Always read the full plan before approving:

```
# Read carefully, then respond
> /respond req-001 approve
```

### 5. Use Pause for Research

If you need time to make a decision:

```
> /pause
⏸️  Task paused

# Research the options...

> /resume
▶️  Task resumed

> /respond req-001 modify Use approach B instead
```

---

## 🐛 Troubleshooting

### Interactive Mode Won't Start

```
❌ Failed to start interactive mode
Error: NATS_URL environment variable is required
```

**Solution**: Ensure NATS is running and `NATS_URL` is set in `.env`

```bash
# Check NATS is running
docker ps | grep nats

# Or start NATS
docker run -d -p 4222:4222 nats:latest
```

### No Updates Appearing

**Possible causes:**
1. Task ID is incorrect
2. Agent hasn't started yet
3. NATS connection issues

**Check:**
```bash
# Verify task exists
multi-agent list-jobs | grep task-123

# Check NATS connection
curl http://localhost:3000/health
```

### Feedback Not Being Received

**Solution**: Agents must be configured to listen for feedback. Check agent logs:

```bash
pm2 logs coder-agent | grep feedback
```

---

## 🔄 Integration with Agents

### Agent-Side Implementation

Agents can request feedback during execution:

```typescript
// In CoderAgent
async implementFeature(feature: Feature): Promise<void> {
  // Create plan
  const plan = await this.createPlan(feature);

  // Request approval
  await this.requestFeedback({
    type: FeedbackRequestType.PLAN_APPROVAL,
    title: 'Plan Approval Needed',
    content: plan,
    options: [
      { value: 'approve', label: 'Approve', description: 'Proceed with this plan' },
      { value: 'modify', label: 'Modify', description: 'Suggest changes' },
      { value: 'reject', label: 'Reject', description: 'Start over' },
    ],
  });

  // Wait for response
  const response = await this.waitForFeedback();

  if (response.type === FeedbackResponseType.APPROVE) {
    // Proceed with implementation
  } else if (response.type === FeedbackResponseType.MODIFY) {
    // Update plan based on feedback
    await this.updatePlan(response.message);
  }
}
```

### Publishing Updates

Agents should publish regular updates:

```typescript
// Publish status update
await this.publishUpdate({
  type: AgentUpdateType.PROGRESS,
  title: 'Implementation Started',
  message: 'Creating database schema',
  progress: 40,
});
```

---

## 📚 Related Documentation

- [CLI Usage Guide](./CLI_USAGE.md) - General CLI commands
- [Agent Architecture](../MULTI_AGENT_SYSTEM_DESIGN.md) - How agents work
- [NATS Messaging](../MULTI_AGENT_SYSTEM_DESIGN.md#messaging) - Message bus details

---

## 🆘 Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review logs: `pm2 logs`
3. Verify NATS connection: `multi-agent health`
4. Open an issue with:
   - Error messages
   - Task ID
   - Steps to reproduce
