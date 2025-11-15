# CLI Usage Guide

## Installation

```bash
# Development
npm run cli -- <command> [options]

# Production
npm run build && npm link
multi-agent <command> [options]
```

## Commands

### `start-project`

Start a new autonomous coding project.

```bash
multi-agent start-project \
  --repo https://github.com/owner/repo \
  --requirements "Build a user authentication system with JWT" \
  [--branch main] \
  [--priority normal|high|urgent]
```

**Example:**
```bash
multi-agent start-project \
  --repo https://github.com/myorg/my-app \
  --requirements "Create REST API for user management" \
  --priority high

# Output: Task ID: task-1234567890-abc123
```

---

### `submit-feature`

Submit a feature request to an existing project.

```bash
multi-agent submit-feature \
  --repo https://github.com/owner/repo \
  --title "Feature Title" \
  --description "Description" \
  [--requirements "req1,req2,req3"] \
  [--priority normal]
```

**Example:**
```bash
multi-agent submit-feature \
  --repo https://github.com/myorg/my-app \
  --title "Password reset" \
  --description "Users can reset password via email" \
  --priority high

# Output: Task ID: task-1234567891-def456
```

---

### `job-status`

Get the status of a task.

```bash
multi-agent job-status <task-id>
```

**Example:**
```bash
multi-agent job-status task-1234567890-abc123

# Output shows: Task ID, Status (PENDING/IN_PROGRESS/COMPLETED/FAILED),
# Priority, timestamps, and result/error details
```

---

### `interactive`

Start interactive mode with real-time monitoring and feedback.

```bash
multi-agent interactive <task-id>
```

**Commands:** `/help`, `/status`, `/pending`, `/respond <id> <choice> [msg]`, `/pause`, `/resume`, `/quit`

**Example:**
```bash
multi-agent interactive task-1234567890-abc123

# Interactive session with real-time updates and feedback requests
# See INTERACTIVE_MODE.md for details
```

---

### `list-jobs`

List all active jobs.

```bash
multi-agent list-jobs [--status pending|in_progress|completed|failed] [--limit 10]
```

**Example:**
```bash
multi-agent list-jobs --status in_progress --limit 5
```

---

### `analyze`

Analyze code using ESLint and TypeScript.

```bash
multi-agent analyze [directory] [--format text|markdown|json] [--output <file>]
```

**Example:**
```bash
multi-agent analyze ./src --format markdown --output report.md

# Shows: files analyzed, errors, warnings, fixable issues
```

---

### `auto-fix`

Automatically fix code issues and create PR.

```bash
multi-agent auto-fix --repo <path> --owner <name> --name <name> \
  [--branch main] [--no-pr] [--no-issue]
```

**Requires:** `GITHUB_TOKEN` or `GH_TOKEN` environment variable

**Example:**
```bash
export GITHUB_TOKEN=your_token

multi-agent auto-fix --repo . --owner myorg --name myrepo

# Fixes issues, creates branch, commits, creates PR and issue for manual fixes
```

---

### `health`

Check system health and agent status.

```bash
multi-agent health [--url http://localhost:3000]
```

**Example:**
```bash
multi-agent health

# Shows: Overall status, uptime, agent status (CODER/REVIEWER/REPO_MANAGER), NATS connection
```

---

## Environment Variables

```bash
# Required
NATS_URL=nats://localhost:4222

# Optional (for health/auto-fix)
HEALTH_PORT=3000
GITHUB_TOKEN=your_github_token
```

Create `.env`:
```bash
cp .env.example .env
```

---

## Troubleshooting

**NATS connection error:** Ensure NATS is running (`curl http://localhost:8222/healthz`)
**Agents not responding:** Start agents with `npm run start:agents`
**Health server unreachable:** Start with `npm run dev:health`

---

## Complete Workflow Example

```bash
# 1. Start project
multi-agent start-project \
  --repo https://github.com/myorg/my-app \
  --requirements "Build blog with auth"
# Output: Task ID: task-XXX

# 2. Monitor
multi-agent interactive task-XXX

# 3. Check health
multi-agent health

# 4. Add features
multi-agent submit-feature \
  --repo https://github.com/myorg/my-app \
  --title "Comment system" \
  --description "Users can comment"
```
