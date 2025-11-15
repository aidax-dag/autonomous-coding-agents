# CLI Usage Guide

> Command-line interface for the Multi-Agent Autonomous Coding System

## Installation

### Development Mode

Use `tsx` to run CLI without building:

```bash
npm run cli -- <command> [options]
```

### Production Mode

Build and install globally:

```bash
npm run build
npm link
```

Then use directly:

```bash
multi-agent <command> [options]
```

## Commands

### `start-project`

Start a new autonomous coding project.

**Usage:**
```bash
multi-agent start-project \
  --repo https://github.com/owner/repo \
  --requirements "Build a user authentication system with JWT" \
  [--branch main] \
  [--priority normal]
```

**Options:**
- `--repo <url>` - GitHub repository URL (required)
- `--requirements <text>` - Project requirements description (required)
- `--branch <name>` - Base branch to work from (default: `main`)
- `--priority <level>` - Priority level: `low`, `normal`, `high`, `urgent` (default: `normal`)

**Example:**
```bash
multi-agent start-project \
  --repo https://github.com/myorg/my-app \
  --requirements "Create a REST API for user management with CRUD operations" \
  --priority high
```

**Output:**
```
✔ Project started successfully! 🚀

📋 Project Details:
  Task ID:      task-1234567890-abc123
  Repository:   myorg/my-app
  Priority:     ⚡ HIGH
  Status:       PENDING

Monitor progress with:
  multi-agent job-status task-1234567890-abc123
```

---

### `submit-feature`

Submit a new feature request to an existing project.

**Usage:**
```bash
multi-agent submit-feature \
  --repo https://github.com/owner/repo \
  --title "Feature Title" \
  --description "Feature description" \
  [--requirements "req1,req2,req3"] \
  [--branch main] \
  [--priority normal]
```

**Options:**
- `--repo <url>` - GitHub repository URL (required)
- `--title <text>` - Feature title (required)
- `--description <text>` - Feature description (required)
- `--requirements <items>` - Comma-separated requirements (optional)
- `--branch <name>` - Target branch (default: `main`)
- `--priority <level>` - Priority level (default: `normal`)

**Example:**
```bash
multi-agent submit-feature \
  --repo https://github.com/myorg/my-app \
  --title "Add password reset functionality" \
  --description "Users should be able to reset their password via email" \
  --requirements "Email validation,Token generation,Password hashing" \
  --priority high
```

**Output:**
```
✔ Feature submitted successfully! ✨

📋 Feature Details:
  Task ID:      task-1234567891-def456
  Title:        Add password reset functionality
  Repository:   myorg/my-app
  Priority:     ⚡ HIGH
  Status:       PENDING

Monitor progress with:
  multi-agent job-status task-1234567891-def456
```

---

### `job-status`

Get the status of a specific task.

**Usage:**
```bash
multi-agent job-status <task-id>
```

**Arguments:**
- `<task-id>` - The task ID returned from `start-project` or `submit-feature`

**Example:**
```bash
multi-agent job-status task-1234567890-abc123
```

**Output (Pending):**
```
📊 Task Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Task ID:      task-1234567890-abc123
  Status:       PENDING
  Priority:     ⚡ HIGH
  Created:      2025-01-15 10:30:45 (5m 23s ago)
```

**Output (In Progress):**
```
📊 Task Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Task ID:      task-1234567890-abc123
  Status:       IN_PROGRESS
  Priority:     ⚡ HIGH
  Created:      2025-01-15 10:30:45 (12m 8s ago)
  Updated:      2025-01-15 10:35:20
```

**Output (Completed):**
```
📊 Task Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Task ID:      task-1234567890-abc123
  Status:       COMPLETED
  Priority:     ⚡ HIGH
  Created:      2025-01-15 10:30:45 (1h 15m ago)
  Updated:      2025-01-15 11:45:53

  Result:
  {
    "pullRequest": {
      "number": 42,
      "url": "https://github.com/myorg/my-app/pull/42",
      "merged": true
    },
    "implementation": {
      "branch": "feature/user-auth",
      "commits": ["a1b2c3d"],
      "filesChanged": 5
    }
  }
```

**Output (Failed):**
```
📊 Task Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Task ID:      task-1234567890-abc123
  Status:       FAILED
  Priority:     ⚡ HIGH
  Created:      2025-01-15 10:30:45 (8m 32s ago)
  Updated:      2025-01-15 10:39:17

  Error:
    Code:     IMPLEMENTATION_FAILED
    Message:  Failed to generate valid code: syntax errors detected
```

---

### `interactive`

Start interactive monitoring mode for a task with real-time updates and feedback.

**Usage:**
```bash
multi-agent interactive <task-id>
```

**Arguments:**
- `<task-id>` - The task ID to monitor (required)

**Example:**
```bash
# Start a project first
multi-agent start-project \
  --repo https://github.com/owner/repo \
  --requirements "Build authentication"

# Copy the task ID from output, then:
multi-agent interactive task-1234567890-abc123
```

**Features:**
- 📊 Real-time agent updates
- 💬 Submit feedback during development
- 🎯 Approve plans before implementation
- ⏸️ Pause/resume task execution
- 📝 Full update history

**Interactive Commands:**
```
> /help              Show available commands
> /status            Show task status
> /pending           List pending feedback requests
> /respond <id> <choice> [message]
                    Respond to feedback request
> /pause             Pause task execution
> /resume            Resume task execution
> /quit              Exit interactive mode
```

**Example Session:**
```
🤖 Interactive Mode Started

Task ID: task-1234567890-abc123
Type /help for available commands

>

📊 Planning Phase Started
   Creating implementation plan

💬 Feedback Requested
   ID: req-001
   Plan Approval Needed

   Implementation plan:
   1. Create User model
   2. Implement JWT authentication
   3. Add password reset

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
```

For detailed interactive mode documentation, see [INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md).

---

### `list-jobs`

List all active jobs in the system.

**Usage:**
```bash
multi-agent list-jobs [--status <status>] [--limit <number>]
```

**Options:**
- `--status <status>` - Filter by status: `pending`, `in_progress`, `completed`, `failed`
- `--limit <number>` - Limit number of results (default: `10`)

**Example:**
```bash
multi-agent list-jobs --status in_progress --limit 5
```

**Output:**
```
📋 Active Jobs (3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. User Authentication System
     Task ID:   task-1234567890-abc123
     Status:    IN_PROGRESS
     Priority:  ⚡ HIGH
     Created:   2025-01-15 10:30:45 (15m ago)

  2. Password Reset Feature
     Task ID:   task-1234567891-def456
     Status:    IN_PROGRESS
     Priority:  ● NORMAL
     Created:   2025-01-15 10:35:20 (10m ago)

  3. Email Notifications
     Task ID:   task-1234567892-ghi789
     Status:    PENDING
     Priority:  ○ LOW
     Created:   2025-01-15 10:40:15 (5m ago)
```

---

### `analyze`

Analyze code for issues using ESLint and TypeScript compiler.

**Usage:**
```bash
multi-agent analyze [directory] [--format <type>] [--output <file>]
```

**Arguments:**
- `[directory]` - Directory to analyze (default: current directory)

**Options:**
- `--format <type>` - Output format: `text`, `markdown`, `json` (default: `text`)
- `--output <file>` - Save report to file

**Example:**
```bash
# Analyze current directory
multi-agent analyze

# Analyze specific directory
multi-agent analyze ./src

# Output as markdown
multi-agent analyze --format markdown

# Save to file
multi-agent analyze --format markdown --output report.md
```

**Output:**
```
✓ Analysis complete!

================================================================================
CODE ANALYSIS REPORT
================================================================================

Generated: 2025-11-16T00:30:00.000Z
Duration: 1234ms

SUMMARY:
  Total Files:   42
  Total Issues:  15
  Errors:        3
  Warnings:      12
  Infos:         0
  Fixable:       10

ISSUES:

  src/agents/coder/coder-agent.ts
    [FIX] ERROR    25:10      @typescript-eslint/no-unused-vars: 'unused' is defined but never used
    [FIX] WARNING  45:30      @typescript-eslint/no-explicit-any: Unexpected any

Summary:
  Files analyzed:  42
  Total issues:    15
  Errors:          3
  Warnings:        12
  Fixable:         10
```

---

### `auto-fix`

Automatically fix code issues and create a pull request.

**Usage:**
```bash
multi-agent auto-fix \
  --repo <path> \
  --owner <name> \
  --name <name> \
  [--branch <name>] \
  [--no-pr] \
  [--no-issue]
```

**Options:**
- `--repo <path>` - Repository path (required)
- `--owner <name>` - GitHub repository owner (required)
- `--name <name>` - GitHub repository name (required)
- `--branch <name>` - Base branch (default: `main`)
- `--no-pr` - Skip PR creation
- `--no-issue` - Skip issue creation for manual fixes

**Prerequisites:**
- `GITHUB_TOKEN` or `GH_TOKEN` environment variable must be set

**Example:**
```bash
# Run auto-fix and create PR
export GITHUB_TOKEN=your_token_here

multi-agent auto-fix \
  --repo /path/to/repo \
  --owner myorg \
  --name myrepo

# Run auto-fix without creating PR
multi-agent auto-fix \
  --repo /path/to/repo \
  --owner myorg \
  --name myrepo \
  --no-pr
```

**Output:**
```
✓ Auto-fix complete!

Fix Report:
  Fixed:           10
  Failed:          0
  Manual:          5
  Files modified:  3

✓ PR created:
  https://github.com/myorg/myrepo/pull/123

ℹ Issue created for manual fixes:
  https://github.com/myorg/myrepo/issues/456
```

**What it does:**
1. Runs ESLint and TypeScript analysis
2. Automatically fixes all fixable issues
3. Creates a new branch
4. Commits the fixes
5. Pushes to GitHub
6. Creates a PR with fix summary
7. Creates an issue for non-fixable problems

---

### `health`

Check system health and agent status.

**Usage:**
```bash
multi-agent health [--url <url>]
```

**Options:**
- `--url <url>` - Health server URL (default: `http://localhost:3000`)

**Example:**
```bash
multi-agent health
```

**Output:**
```
🏥 System Health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Overall Status:  ✅ HEALTHY
  Uptime:          2h 15m 30s
  Agent Count:     3

  Agents:
    ✅ CODER: 1/1 healthy, 1 idle, 0 working
    ✅ REVIEWER: 1/1 healthy, 1 idle, 0 working
    ✅ REPO_MANAGER: 1/1 healthy, 0 idle, 1 working

  Dependencies:
    ✅ NATS: Connected
```

**Degraded State:**
```
🏥 System Health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Overall Status:  ⚠️ DEGRADED
  Uptime:          2h 15m 30s
  Agent Count:     3

  Agents:
    ⚠️ CODER: 0/1 healthy, 0 idle, 0 working
    ✅ REVIEWER: 1/1 healthy, 1 idle, 0 working
    ✅ REPO_MANAGER: 1/1 healthy, 0 idle, 1 working

  Dependencies:
    ✅ NATS: Connected
```

---

## Environment Variables

The CLI requires the following environment variables:

```bash
# Required
NATS_URL=nats://localhost:4222

# Optional
HEALTH_PORT=3000
```

Create a `.env` file in the project root:

```bash
cp .env.example .env
# Edit .env with your configuration
```

---

## Troubleshooting

### "NATS_URL environment variable is required"

**Solution:** Create a `.env` file with NATS configuration:
```bash
echo "NATS_URL=nats://localhost:4222" > .env
```

### "No response from agents (timeout)"

**Possible causes:**
1. Agents are not running
2. NATS server is not running
3. Network connectivity issues

**Solutions:**

Check if agents are running:
```bash
pm2 status
```

Start agents if not running:
```bash
npm run start:agents
```

Check NATS server:
```bash
# If using Docker
docker ps | grep nats

# Or check locally
curl http://localhost:8222/healthz
```

### "Could not connect to health server"

**Solution:** Start the health server:
```bash
npm run dev:health
```

Or check if it's running via PM2:
```bash
pm2 status health-server
```

---

## Examples

### Complete Workflow

1. **Start a new project:**
```bash
multi-agent start-project \
  --repo https://github.com/myorg/my-app \
  --requirements "Build a blog platform with user auth and markdown support"
```

Output: `Task ID: task-1234567890-abc123`

2. **Check status:**
```bash
multi-agent job-status task-1234567890-abc123
```

3. **Monitor system health:**
```bash
multi-agent health
```

4. **Submit additional features:**
```bash
multi-agent submit-feature \
  --repo https://github.com/myorg/my-app \
  --title "Add comment system" \
  --description "Users should be able to comment on blog posts"
```

5. **List all active jobs:**
```bash
multi-agent list-jobs
```

---

## Integration with CI/CD

### GitHub Actions

```yaml
name: Submit Feature Request

on:
  issues:
    types: [labeled]

jobs:
  submit-feature:
    if: github.event.label.name == 'auto-implement'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install CLI
        run: npm install -g autonomous-coding-agents

      - name: Submit Feature
        env:
          NATS_URL: ${{ secrets.NATS_URL }}
        run: |
          multi-agent submit-feature \
            --repo ${{ github.repository }} \
            --title "${{ github.event.issue.title }}" \
            --description "${{ github.event.issue.body }}"
```

---

## Tips

1. **Save Task IDs**: Keep track of task IDs for monitoring:
   ```bash
   multi-agent start-project ... | tee task-id.txt
   ```

2. **Watch Status**: Poll status periodically:
   ```bash
   watch -n 5 'multi-agent job-status task-1234567890-abc123'
   ```

3. **JSON Output**: Pipe to `jq` for JSON processing:
   ```bash
   multi-agent list-jobs | jq '.jobs[] | select(.status=="IN_PROGRESS")'
   ```

4. **Alias for Convenience**:
   ```bash
   alias mag='multi-agent'
   mag start-project --repo ... --requirements ...
   ```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-username/autonomous-coding-agents/issues
- Documentation: https://github.com/your-username/autonomous-coding-agents/docs
