# Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- ACP MessageBus (built-in, no external server needed)
- PM2 (process management)
- Git

## Installation

```bash
# 1. Clone and install
git clone https://github.com/your-username/autonomous-coding-agents.git
cd autonomous-coding-agents
npm install

# 2. Install PM2 globally
npm install -g pm2

# 3. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 4. Build
npm run build

# 5. Database migration
npm run db:migrate
```

### Required Environment Variables

```bash
GITHUB_TOKEN=your_github_token
LLM_PROVIDER=claude  # or openai, gemini
ANTHROPIC_API_KEY=your_api_key  # or OPENAI_API_KEY, GEMINI_API_KEY
DATABASE_URL=postgresql://user:password@localhost:5432/multi_agent_db
```

---

## Running Agents

### Development Mode

Start individual agents with hot reload:

```bash
npm run dev:coder           # Coder Agent
npm run dev:reviewer        # Reviewer Agent
npm run dev:repo-manager    # Repo Manager Agent
npm run dev:health          # Health Server
```

### Production Mode (PM2)

```bash
# Start all agents
npm run start:agents

# Stop all
npm run stop:agents

# Restart all
npm run restart:agents

# Delete from PM2
npm run delete:agents
```

Started agents:
- `coder-agent` - Code implementation
- `reviewer-agent` - Code review
- `repo-manager-agent` - Workflow orchestration

---

## Managing Agents

### View Status

```bash
pm2 status
# or
npm run monit
```

### View Logs

```bash
npm run logs                 # All agents
npm run logs:coder           # Coder agent
npm run logs:reviewer        # Reviewer agent
npm run logs:repo-manager    # Repo Manager agent
```

Log files location:
- `logs/coder-agent-*.log`
- `logs/reviewer-agent-*.log`
- `logs/repo-manager-agent-*.log`

---

## Configuration

### PM2 Settings

Edit `ecosystem.config.js` to customize:

```javascript
{
  name: 'coder-agent',
  script: 'dist/bin/start-coder.js',
  max_memory_restart: '1G',    // Memory limit
  max_restarts: 10,            // Restart attempts
  min_uptime: '10s',           // Minimum uptime
  env: {
    NODE_ENV: 'production',
    AGENT_ID: 'coder-1',
  }
}
```

### Auto-start on Boot

```bash
pm2 startup
# Follow printed instructions

pm2 save  # Save current process list
```

### Log Rotation

```bash
pm2 install pm2-logrotate

pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

---

## Monitoring

### Health Checks

```bash
# Check agent health
curl http://localhost:3000/health

# Or use CLI
multi-agent health
```

### PM2 Monitoring

```bash
npm run monit  # Real-time metrics
```

---

## Scaling

### Multiple Instances

Edit `ecosystem.config.js`:

```javascript
{
  name: 'coder-agent',
  script: 'dist/bin/start-coder.js',
  instances: 2,              // Run 2 instances
  exec_mode: 'cluster',
}
```

Or use PM2 scale command:

```bash
pm2 scale coder-agent 3  # Scale to 3 instances
```

ACP MessageBus provides in-process message routing across agent instances.

---

## Troubleshooting

### Agent Not Starting

1. Check logs: `npm run logs`
2. Verify `.env` file configuration
3. Check database: `npm run db:studio`

### High Memory Usage

1. Check usage: `pm2 monit`
2. Increase limit in `ecosystem.config.js`
3. Restart agent: `pm2 restart [agent-name]`

### Agent Crashing

PM2 auto-restarts crashed agents. Check error logs:

```bash
npm run logs:coder  # Check for errors before crash
```

Common causes:
- Invalid API keys
- ACP MessageBus connection lost
- Database connection issues
- Out of memory

---

## Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] ACP MessageBus initialized (built-in, starts with agents)
- [ ] GitHub token valid
- [ ] LLM API keys valid
- [ ] PM2 auto-start configured (`pm2 startup && pm2 save`)
- [ ] Log rotation configured
- [ ] Health endpoints tested (`curl http://localhost:3000/health`)
- [ ] Backup strategy implemented

---

## Security

### API Keys
- Store in `.env` (never commit to git)
- Rotate regularly
- Use GitHub App authentication when possible

### Network
- Secure ACP MessageBus communication channels
- Use TLS for external connections in production
- Restrict database to localhost/private network
- Firewall health endpoints

### Permissions
- Run agents with minimal required permissions
- Separate GitHub accounts/apps per environment
- Implement audit logging

---

## Updates

### Code Updates

```bash
git pull origin main
npm install
npm run build
npm run restart:agents
```

### Database Migrations

```bash
npm run db:migrate
npm run restart:agents  # If schema changed
```

---

## Support

- GitHub Issues: https://github.com/your-username/autonomous-coding-agents/issues
- Documentation: https://github.com/your-username/autonomous-coding-agents/docs
