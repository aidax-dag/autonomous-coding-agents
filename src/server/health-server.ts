/**
 * Health Check Server
 *
 * Provides HTTP endpoints for monitoring agent health and system status.
 * Used by load balancers, monitoring systems, and operators.
 *
 * Endpoints:
 * - GET /health - Overall system health
 * - GET /health/agents - Detailed agent status
 * - GET /health/agents/:agentId - Specific agent status
 * - GET /metrics - System metrics
 *
 * Feature: F5.3 - Health Check & Monitoring
 */

import * as http from 'http';
import { AgentManager, SystemHealth } from '@/agents/manager/agent-manager';
import { NatsClient } from '@/shared/messaging/nats-client';
import { createAgentLogger } from '@/shared/logging/logger';
import { WebhookServer, WebhookServerStatus } from './webhook/index.js';

export interface HealthServerConfig {
  port: number;
  host?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  system: SystemHealth;
  dependencies: {
    nats: {
      connected: boolean;
      stats?: {
        connected: boolean;
        subscriptions: number;
      };
    };
    webhook?: WebhookServerStatus;
  };
}

export interface MetricsResponse {
  timestamp: number;
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  };
  agents: SystemHealth['agents'];
}

/**
 * Health Check HTTP Server
 */
export class HealthServer {
  private server: http.Server | null = null;
  private logger = createAgentLogger('HEALTH', 'health-server');
  private startTime = Date.now();

  constructor(
    private config: HealthServerConfig,
    private agentManager: AgentManager,
    private natsClient: NatsClient,
    private webhookServer?: WebhookServer
  ) {}

  /**
   * Start the health check server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Health server already started');
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        this.logger.error('Error handling request', { error, url: req.url });
        this.sendError(res, 500, 'Internal Server Error');
      });
    });

    const { port, host = '0.0.0.0' } = this.config;

    return new Promise((resolve, reject) => {
      this.server!.listen(port, host, () => {
        this.logger.info('Health server started', { port, host });
        resolve();
      });

      this.server!.on('error', (error) => {
        this.logger.error('Health server error', { error });
        reject(error);
      });
    });
  }

  /**
   * Stop the health check server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          this.logger.error('Error stopping health server', { error });
          reject(error);
        } else {
          this.logger.info('Health server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle HTTP request
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (method !== 'GET') {
      this.sendError(res, 405, 'Method Not Allowed');
      return;
    }

    // Route handling
    if (url === '/health') {
      await this.handleHealthCheck(res);
    } else if (url === '/health/agents') {
      await this.handleAgentsHealth(res);
    } else if (url.startsWith('/health/agents/')) {
      const agentId = url.substring('/health/agents/'.length);
      await this.handleAgentHealth(res, agentId);
    } else if (url === '/metrics') {
      await this.handleMetrics(res);
    } else if (url === '/') {
      this.sendJSON(res, 200, {
        name: 'Multi-Agent Autonomous Coding System',
        version: '1.0.0',
        endpoints: [
          'GET /health',
          'GET /health/agents',
          'GET /health/agents/:agentId',
          'GET /metrics',
        ],
        webhook: this.webhookServer
          ? {
              enabled: this.webhookServer.getStatus().running,
              port: this.webhookServer.getStatus().port,
            }
          : { enabled: false },
      });
    } else {
      this.sendError(res, 404, 'Not Found');
    }
  }

  /**
   * Handle /health endpoint
   */
  private async handleHealthCheck(res: http.ServerResponse): Promise<void> {
    const systemHealth = await this.agentManager.getSystemHealth();
    const natsStats = this.natsClient.getStats();

    const response: HealthResponse = {
      status: systemHealth.healthy ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      system: systemHealth,
      dependencies: {
        nats: {
          connected: this.natsClient.isConnected(),
          stats: natsStats || undefined,
        },
        webhook: this.webhookServer ? this.webhookServer.getStatus() : undefined,
      },
    };

    // Determine overall status
    if (!this.natsClient.isConnected()) {
      response.status = 'unhealthy';
    } else if (!systemHealth.healthy) {
      response.status = 'degraded';
    }

    const statusCode = response.status === 'healthy' ? 200 : 503;
    this.sendJSON(res, statusCode, response);
  }

  /**
   * Handle /health/agents endpoint
   */
  private async handleAgentsHealth(res: http.ServerResponse): Promise<void> {
    const agents = this.agentManager.listAgents();

    const agentStatuses = agents.map((agent) => ({
      id: agent.getId(),
      type: agent.getAgentType(),
      state: agent.getState(),
      health: agent.getHealth(),
    }));

    this.sendJSON(res, 200, {
      count: agents.length,
      agents: agentStatuses,
    });
  }

  /**
   * Handle /health/agents/:agentId endpoint
   */
  private async handleAgentHealth(
    res: http.ServerResponse,
    agentId: string
  ): Promise<void> {
    const agent = this.agentManager.getAgent(agentId);

    if (!agent) {
      this.sendError(res, 404, `Agent ${agentId} not found`);
      return;
    }

    const config = agent.getConfig();
    const health = agent.getHealth();

    this.sendJSON(res, 200, {
      id: agent.getId(),
      type: agent.getAgentType(),
      name: config.name,
      state: agent.getState(),
      health,
      config: {
        maxConcurrentTasks: config.maxConcurrentTasks ?? 1,
        timeout: config.timeout ?? 30000,
      },
    });
  }

  /**
   * Handle /metrics endpoint
   */
  private async handleMetrics(res: http.ServerResponse): Promise<void> {
    const systemHealth = await this.agentManager.getSystemHealth();

    const metrics: MetricsResponse = {
      timestamp: Date.now(),
      system: {
        uptime: Date.now() - this.startTime,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      agents: systemHealth.agents,
    };

    this.sendJSON(res, 200, metrics);
  }

  /**
   * Send JSON response
   */
  private sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  private sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    this.sendJSON(res, statusCode, {
      error: {
        code: statusCode,
        message,
      },
    });
  }
}
