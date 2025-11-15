# Phase 3: Integration, Testing & Deployment

> Implementation Plan for completing the Multi-Agent Autonomous Coding System MVP

## 📋 Overview

**Phase**: 3 (corresponds to Phase 5 in original roadmap)
**Timeline**: 2-3 weeks
**Status**: Planning → Implementation
**Previous Phases**:
- ✅ Phase 1: Infrastructure (F1.1-F1.8)
- ✅ Phase 2: Agent Implementations (F2.1-F2.5, including Reviewer & Repo Manager)

## 🎯 Goals

This phase completes the MVP by:

1. **Integration Testing**: Validate end-to-end workflows with comprehensive tests
2. **Process Management**: Enable 24/7 background execution of agents
3. **Observability**: Implement health checks and monitoring
4. **User Interface**: Provide CLI for user interaction
5. **Notifications**: Alert users of important events

## 📦 Features

### F5.1: E2E Workflow Tests ⭐ Priority: P0

**User Story**: As a developer, I need end-to-end tests to ensure the entire workflow works correctly from requirements to merge.

**Scope**:
- Complete workflow testing with real NATS broker
- Test all agent interactions (Coder ↔ Reviewer ↔ Repo Manager)
- Validate task lifecycle (creation → processing → result)
- Error scenario testing (LLM failures, GitHub API errors, timeouts)
- Performance benchmarking

**Implementation Plan**:

```typescript
// Test structure
describe('E2E Agent Workflow', () => {
  describe('Feature Implementation Workflow', () => {
    it('should complete full implementation cycle', async () => {
      // 1. Send FeatureRequest to Repo Manager
      // 2. Verify ImplementationRequest sent to Coder
      // 3. Wait for ImplementationResult
      // 4. Verify ReviewRequest sent to Reviewer
      // 5. Wait for ReviewResult with APPROVE
      // 6. Verify PR merge
      // 7. Validate FeatureResult
    });
  });

  describe('Review Feedback Loop', () => {
    it('should handle review comments and iterate', async () => {
      // Test REQUEST_CHANGES scenario
    });
  });

  describe('Error Handling', () => {
    it('should retry on retryable errors', async () => {
      // Test LLM rate limits, transient failures
    });

    it('should fail gracefully on non-retryable errors', async () => {
      // Test validation errors, auth failures
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Test environment setup with NATS server (docker-compose)
- [ ] Mock GitHub client for PR operations
- [ ] Mock LLM client with predefined responses
- [ ] 15+ E2E test scenarios covering happy path and error cases
- [ ] Test execution time < 5 minutes
- [ ] All tests passing with >90% coverage on agent code

**Dependencies**: All Phase 2 agents (F2.1-F2.5)

**Estimated Effort**: 5-7 days

---

### F5.2: Process Manager Integration ⭐ Priority: P0

**User Story**: As an operator, I need a process manager to run agents in the background 24/7 with automatic restart on failure.

**Scope**:
- PM2 configuration for production deployment
- Individual process management for each agent
- Automatic restart on crashes
- Log aggregation and rotation
- CPU/memory monitoring

**Implementation Plan**:

1. **PM2 Ecosystem File**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'coder-agent',
      script: 'dist/agents/coder/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        AGENT_ID: 'coder-1'
      }
    },
    {
      name: 'reviewer-agent',
      script: 'dist/agents/reviewer/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        AGENT_ID: 'reviewer-1'
      }
    },
    {
      name: 'repo-manager-agent',
      script: 'dist/agents/repo-manager/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        AGENT_ID: 'repo-manager-1'
      }
    }
  ]
};
```

2. **Entry Point Files**:
```typescript
// src/agents/coder/index.ts
import { CoderAgent } from './coder-agent';
import { getConfig } from '@/shared/config';

async function main() {
  const config = getConfig();
  const agent = new CoderAgent(config.coder);

  await agent.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await agent.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

3. **NPM Scripts**:
```json
{
  "scripts": {
    "start:agents": "pm2 start ecosystem.config.js",
    "stop:agents": "pm2 stop ecosystem.config.js",
    "restart:agents": "pm2 restart ecosystem.config.js",
    "logs": "pm2 logs",
    "monit": "pm2 monit"
  }
}
```

**Acceptance Criteria**:
- [ ] PM2 ecosystem configuration file created
- [ ] Entry point files for all 3 agents
- [ ] NPM scripts for start/stop/restart
- [ ] Agents restart automatically on crash (tested)
- [ ] Log files properly rotated (daily, 30 day retention)
- [ ] Memory limits enforced (1GB per agent)

**Dependencies**: F2.1 (BaseAgent), all agent implementations

**Estimated Effort**: 2-3 days

---

### F5.3: Health Check & Monitoring ⭐ Priority: P0

**User Story**: As an operator, I need health check endpoints to monitor agent status and diagnose issues.

**Scope**:
- HTTP health check server
- Agent status endpoints
- Dependency health checks (NATS, Database, GitHub)
- Metrics collection (tasks processed, errors, latency)
- Prometheus metrics export (optional)

**Implementation Plan**:

1. **Health Check Server**:
```typescript
// src/server/health-server.ts
import express from 'express';
import { AgentManager } from '@/agents/manager/agent-manager';
import { NatsClient } from '@/shared/messaging/nats-client';

export class HealthServer {
  private app = express();

  constructor(
    private agentManager: AgentManager,
    private natsClient: NatsClient
  ) {
    this.setupRoutes();
  }

  private setupRoutes() {
    // Overall health
    this.app.get('/health', async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        agents: await this.getAgentHealth(),
        dependencies: await this.getDependencyHealth()
      };

      const isHealthy = health.agents.every(a => a.healthy)
        && health.dependencies.nats.connected;

      res.status(isHealthy ? 200 : 503).json(health);
    });

    // Agent-specific health
    this.app.get('/health/agents/:agentId', async (req, res) => {
      const agentId = req.params.agentId;
      const status = await this.agentManager.getAgentStatus(agentId);
      res.json(status);
    });

    // Metrics
    this.app.get('/metrics', async (req, res) => {
      const metrics = await this.agentManager.getMetrics();
      res.json(metrics);
    });
  }

  private async getAgentHealth() {
    const agents = this.agentManager.listAgents();
    return Promise.all(
      agents.map(async (agent) => ({
        id: agent.getId(),
        type: agent.getAgentType(),
        healthy: agent.getHealth().healthy,
        state: agent.getState(),
        uptime: agent.getHealth().uptime,
        tasksProcessed: agent.getHealth().tasksProcessed,
        tasksFailed: agent.getHealth().tasksFailed,
        errorRate: agent.getHealth().errorRate
      }))
    );
  }

  private async getDependencyHealth() {
    return {
      nats: {
        connected: this.natsClient.isConnected(),
        stats: this.natsClient.getStats()
      }
    };
  }

  async start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`Health server listening on port ${port}`);
    });
  }
}
```

2. **Metrics Interface**:
```typescript
export interface SystemMetrics {
  agents: {
    [agentId: string]: {
      tasksProcessed: number;
      tasksFailed: number;
      averageTaskDuration: number;
      errorRate: number;
      lastTaskCompletedAt?: number;
    };
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}
```

**Acceptance Criteria**:
- [ ] HTTP server with `/health`, `/health/agents/:id`, `/metrics` endpoints
- [ ] Health checks return proper HTTP status codes (200, 503)
- [ ] Metrics include task counts, error rates, latencies
- [ ] NATS connection status checked
- [ ] Response time < 100ms for health checks
- [ ] Integration with PM2 for process monitoring

**Dependencies**: F2.2 (AgentManager), F1.1 (NATS Client)

**Estimated Effort**: 2-3 days

---

### F5.4: CLI Interface ⭐ Priority: P0

**User Story**: As a user, I need a CLI to start projects, submit feature requests, and monitor progress.

**Scope**:
- Commander.js based CLI
- Commands: start-project, submit-feature, job-status, list-jobs, stop-job
- Pretty terminal output with colors and spinners
- Configuration management

**Implementation Plan**:

1. **CLI Structure**:
```typescript
// src/cli/index.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { NatsClient } from '@/shared/messaging/nats-client';
import { FeatureRequest, TaskPriority, AgentType, TaskStatus } from '@/agents/base/types';

const program = new Command();

program
  .name('multi-agent')
  .description('Multi-Agent Autonomous Coding System CLI')
  .version('1.0.0');

program
  .command('start-project')
  .description('Start a new project with requirements')
  .requiredOption('--repo <url>', 'Repository URL')
  .requiredOption('--requirements <text>', 'Project requirements')
  .option('--branch <name>', 'Base branch', 'main')
  .action(async (options) => {
    const spinner = ora('Starting project...').start();

    try {
      const natsClient = await initNatsClient();

      const featureRequest: FeatureRequest = {
        id: generateId(),
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: parseRepoUrl(options.repo),
          feature: {
            title: 'Project Setup',
            description: options.requirements,
            requirements: [options.requirements]
          }
        },
        metadata: {
          createdAt: Date.now()
        }
      };

      await natsClient.publish('task.repo-manager', featureRequest);

      spinner.succeed(chalk.green(`Project started! Task ID: ${featureRequest.id}`));
      console.log(chalk.gray(`\nMonitor progress with: multi-agent job-status ${featureRequest.id}`));

      await natsClient.close();
    } catch (error) {
      spinner.fail(chalk.red(`Failed to start project: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('submit-feature')
  .description('Submit a new feature request to existing project')
  .requiredOption('--repo <url>', 'Repository URL')
  .requiredOption('--title <text>', 'Feature title')
  .requiredOption('--description <text>', 'Feature description')
  .option('--requirements <items>', 'Comma-separated requirements')
  .action(async (options) => {
    // Similar implementation
  });

program
  .command('job-status <task-id>')
  .description('Get status of a task')
  .action(async (taskId) => {
    const spinner = ora('Fetching status...').start();

    try {
      const natsClient = await initNatsClient();

      // Request status from repo manager
      const response = await natsClient.request(
        'status.request',
        JSON.stringify({ taskId }),
        { timeout: 5000 }
      );

      const status = JSON.parse(response.data.toString());

      spinner.stop();

      console.log(chalk.bold(`\nTask: ${taskId}`));
      console.log(chalk.gray(`Status: ${getStatusColor(status.status)}`));
      console.log(chalk.gray(`Created: ${new Date(status.createdAt).toLocaleString()}`));

      if (status.result) {
        console.log(chalk.bold('\nResult:'));
        console.log(JSON.stringify(status.result, null, 2));
      }

      await natsClient.close();
    } catch (error) {
      spinner.fail(chalk.red(`Failed to fetch status: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
```

2. **Helper Functions**:
```typescript
function parseRepoUrl(url: string): { owner: string; repo: string; url: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
    url
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return chalk.green(status);
    case 'FAILED':
      return chalk.red(status);
    case 'IN_PROGRESS':
      return chalk.yellow(status);
    default:
      return chalk.gray(status);
  }
}
```

**Acceptance Criteria**:
- [ ] `start-project` command creates and submits FeatureRequest
- [ ] `submit-feature` command for additional features
- [ ] `job-status <task-id>` displays current task status
- [ ] `list-jobs` shows all active jobs
- [ ] Pretty output with chalk colors and ora spinners
- [ ] Error handling with helpful messages
- [ ] Executable via `npx multi-agent` or global install

**Dependencies**: F1.1 (NATS Client), F2.5 (Repo Manager)

**Estimated Effort**: 2-3 days

---

### F5.5: Notification System 💡 Priority: P1 (Optional)

**User Story**: As a user, I want to receive notifications when important events occur (PR created, features complete, errors).

**Scope**:
- Slack webhook integration
- Discord webhook integration
- Email notifications (optional)
- Configurable notification levels
- Event-driven architecture

**Implementation Plan**:

```typescript
// src/shared/notifications/notifier.ts
export interface NotificationConfig {
  enabled: boolean;
  slack?: {
    webhookUrl: string;
    channel?: string;
  };
  discord?: {
    webhookUrl: string;
  };
  email?: {
    smtp: string;
    from: string;
    to: string[];
  };
  level: 'info' | 'warning' | 'error';
}

export interface Notification {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  url?: string;
  timestamp: number;
}

export class Notifier {
  constructor(private config: NotificationConfig) {}

  async send(notification: Notification): Promise<void> {
    if (!this.config.enabled) return;
    if (!this.shouldSend(notification.level)) return;

    const promises: Promise<void>[] = [];

    if (this.config.slack) {
      promises.push(this.sendSlack(notification));
    }

    if (this.config.discord) {
      promises.push(this.sendDiscord(notification));
    }

    await Promise.allSettled(promises);
  }

  private async sendSlack(notification: Notification): Promise<void> {
    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      error: '#ff0000'
    }[notification.level];

    const payload = {
      attachments: [
        {
          color,
          title: notification.title,
          text: notification.message,
          ts: Math.floor(notification.timestamp / 1000),
          ...(notification.url && {
            actions: [
              {
                type: 'button',
                text: 'View Details',
                url: notification.url
              }
            ]
          })
        }
      ]
    };

    await fetch(this.config.slack!.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  private shouldSend(level: string): boolean {
    const levels = ['info', 'warning', 'error'];
    const configLevel = levels.indexOf(this.config.level);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }
}
```

**Acceptance Criteria**:
- [ ] Slack webhook integration with formatted messages
- [ ] Discord webhook integration
- [ ] Configurable notification levels
- [ ] Event handlers for PR creation, completion, errors
- [ ] Graceful failure if webhooks are down
- [ ] Rate limiting to prevent spam

**Dependencies**: F1.4 (Config)

**Estimated Effort**: 2-3 days

---

## 🗓️ Implementation Schedule

### Week 1: Testing Foundation
- **Days 1-3**: F5.1 test infrastructure setup
  - Docker compose for NATS
  - Mock implementations
  - Test utilities
- **Days 4-5**: F5.1 core E2E tests
  - Happy path workflow
  - Basic error scenarios

### Week 2: Integration & Deployment
- **Days 1-2**: F5.1 complete (advanced scenarios)
- **Days 3-4**: F5.2 Process Manager Integration
- **Day 5**: F5.3 Health Check Server (initial)

### Week 3: User Interface & Polish
- **Days 1-2**: F5.4 CLI Interface
- **Days 3-4**: F5.3 Health Check (metrics & polish)
- **Day 5**: F5.5 Notifications (if time allows)

## 🧪 Testing Strategy

### Unit Tests
- All new classes and functions have unit tests
- Maintain >80% code coverage
- Mock external dependencies

### Integration Tests
- Test NATS message flow between agents
- Test GitHub client with real API (using test repository)
- Test database operations with test database

### E2E Tests
- Full workflow from FeatureRequest to merge
- Error recovery scenarios
- Performance benchmarks

### Manual Testing
- Deploy to staging environment
- Test with real repository
- Validate 24/7 operation over 48 hours

## 📊 Success Criteria

### Functional Requirements
- [ ] All E2E tests passing
- [ ] Agents run 24/7 without manual intervention
- [ ] Health checks provide accurate status
- [ ] CLI commands work correctly
- [ ] Notifications delivered successfully

### Non-Functional Requirements
- [ ] Task completion time < 30 minutes for simple features
- [ ] Error rate < 5%
- [ ] System uptime > 95%
- [ ] Memory usage < 1GB per agent
- [ ] API response time < 200ms for health checks

### Documentation
- [ ] Setup guide updated
- [ ] CLI usage documented
- [ ] API documentation for health endpoints
- [ ] Troubleshooting guide created

## 🚀 Deployment Plan

### Staging Environment
1. Deploy to cloud VM (AWS EC2, DigitalOcean, etc.)
2. Install dependencies (Node.js, PostgreSQL, NATS)
3. Configure environment variables
4. Start agents with PM2
5. Test with sample repository

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] NATS server configured with persistence
- [ ] PM2 configured for auto-start on boot
- [ ] Health checks configured in load balancer
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented

## 🔄 Post-MVP Improvements (Phase 4)

After completing Phase 3, consider:

1. **Advanced Features** (from F6.x):
   - Parallel feature development (F6.1)
   - Test automation (F6.3)
   - GitHub webhooks (F6.6)

2. **Performance Optimization**:
   - Agent scaling (multiple instances)
   - Caching strategies
   - Database query optimization

3. **User Experience**:
   - Web dashboard
   - Real-time progress updates
   - Interactive feedback mechanism

## 📝 Notes

- Phase 2 PR (#1) must be merged before starting Phase 3 implementation
- All Phase 3 work will be done on a new `phase3` branch
- Maintain strict TDD approach: tests first, then implementation
- Focus on MVP scope - defer nice-to-have features to Phase 4

---

**Last Updated**: 2025-11-15
**Status**: Planning Complete → Ready for Implementation
