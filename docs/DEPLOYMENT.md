# Deployment Guide

> Production deployment guide for Multi-Agent Autonomous Coding System

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- NATS Server 2.x
- PM2 (for process management)
- Git

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/autonomous-coding-agents.git
cd autonomous-coding-agents
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install PM2 Globally

```bash
npm install -g pm2
```

### 4. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `NATS_URL` - NATS server URL
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `LLM_PROVIDER` - LLM provider (claude, openai, or gemini)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` - LLM API key
- `DATABASE_URL` - PostgreSQL connection string

### 5. Build

```bash
npm run build
```

### 6. Database Migration

```bash
npm run db:migrate
```

## Starting Agents

### Development Mode

Start individual agents with hot reload:

```bash
# Start Coder Agent
npm run dev:coder

# Start Reviewer Agent
npm run dev:reviewer

# Start Repo Manager Agent
npm run dev:repo-manager
```

### Production Mode with PM2

Start all agents:

```bash
npm run start:agents
```

This will start:
- `coder-agent` - Code implementation agent
- `reviewer-agent` - Code review agent
- `repo-manager-agent` - Workflow orchestration agent

## Managing Agents

### View Status

```bash
pm2 status
```

Or use the monitoring dashboard:

```bash
npm run monit
```

### View Logs

All agents:
```bash
npm run logs
```

Specific agent:
```bash
npm run logs:coder
npm run logs:reviewer
npm run logs:repo-manager
```

### Stop Agents

```bash
npm run stop:agents
```

### Restart Agents

```bash
npm run restart:agents
```

### Delete Agents from PM2

```bash
npm run delete:agents
```

## Configuration

### PM2 Configuration

Edit `ecosystem.config.js` to customize:

- **Memory limits**: `max_memory_restart` (default: 1G)
- **Restart policy**: `max_restarts`, `min_uptime`, `restart_delay`
- **Log files**: `error_file`, `out_file`
- **Environment variables**: Add custom env vars in `env` section

Example:

```javascript
{
  name: 'coder-agent',
  script: 'dist/bin/start-coder.js',
  max_memory_restart: '2G', // Increase memory limit
  env: {
    NODE_ENV: 'production',
    AGENT_ID: 'coder-1',
    MAX_CONCURRENT_TASKS: 2, // Override default
  }
}
```

### Auto-start on Boot

Setup PM2 to start on system boot:

```bash
pm2 startup
# Follow the instructions printed

# Save current process list
pm2 save
```

### Log Rotation

Configure log rotation with PM2:

```bash
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## Monitoring

### PM2 Monitoring

View real-time metrics:

```bash
npm run monit
```

### Health Checks

The system includes HTTP health check endpoints (see F5.3 implementation).

Check agent health:
```bash
curl http://localhost:3000/health
```

### Logging

Logs are written to:
- `logs/coder-agent-out.log` - Coder agent output
- `logs/coder-agent-error.log` - Coder agent errors
- `logs/reviewer-agent-out.log` - Reviewer agent output
- `logs/reviewer-agent-error.log` - Reviewer agent errors
- `logs/repo-manager-agent-out.log` - Repo Manager output
- `logs/repo-manager-agent-error.log` - Repo Manager errors

## Scaling

### Multiple Instances

To run multiple instances of an agent, edit `ecosystem.config.js`:

```javascript
{
  name: 'coder-agent',
  script: 'dist/bin/start-coder.js',
  instances: 2, // Run 2 instances
  exec_mode: 'cluster', // Cluster mode
  env: {
    AGENT_ID: 'coder-${instance}', // Dynamic ID
  }
}
```

Or use PM2 scale command:

```bash
pm2 scale coder-agent 3  # Scale to 3 instances
```

### Load Balancing

Agents use NATS for message distribution, which provides automatic load balancing across multiple instances.

## Troubleshooting

### Agent Not Starting

1. Check logs: `npm run logs`
2. Verify environment variables: Check `.env` file
3. Test NATS connection: `curl http://localhost:8222/healthz`
4. Check database connection: `npm run db:studio`

### High Memory Usage

1. Check current usage: `pm2 monit`
2. Increase memory limit in `ecosystem.config.js`
3. Review agent logs for memory leaks
4. Restart agent: `pm2 restart [agent-name]`

### Agent Crashing

PM2 will automatically restart crashed agents. Check error logs:

```bash
npm run logs:coder
# Look for error messages before crash
```

Common causes:
- Invalid API keys
- NATS connection lost
- Database connection issues
- Out of memory

### Graceful Shutdown Not Working

Agents listen for SIGTERM and SIGINT signals. If graceful shutdown fails:

```bash
# Force stop
pm2 stop [agent-name] --force

# Force delete
pm2 delete [agent-name] --force
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] NATS server running and accessible
- [ ] GitHub token valid with required permissions
- [ ] LLM API keys valid
- [ ] PM2 configured for auto-start on boot
- [ ] Log rotation configured
- [ ] Health check endpoints tested
- [ ] Backup strategy implemented
- [ ] Monitoring alerts configured

## Security

### API Keys

- Store API keys in `.env` file (never commit to git)
- Use environment-specific `.env` files
- Rotate API keys regularly
- Use GitHub App authentication instead of Personal Access Token when possible

### Network

- Run NATS with authentication enabled
- Use TLS for NATS connections in production
- Restrict database access to localhost or private network
- Use firewall to limit access to health check endpoints

### Permissions

- Run agents with minimal required permissions
- Use separate GitHub accounts/apps for different environments
- Implement audit logging for sensitive operations

## Updates

### Updating Code

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Rebuild
npm run build

# Restart agents
npm run restart:agents
```

### Database Migrations

```bash
# Apply migrations
npm run db:migrate

# Restart agents if schema changed
npm run restart:agents
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-username/autonomous-coding-agents/issues
- Documentation: https://github.com/your-username/autonomous-coding-agents/docs
