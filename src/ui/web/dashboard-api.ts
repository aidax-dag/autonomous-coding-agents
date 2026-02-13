/**
 * Dashboard API
 * REST endpoints for the web dashboard.
 * @module ui/web
 */

import type { IWebServer, WebRequest, WebResponse, SSEBroker } from './interfaces/web.interface';
import type { IHUDDashboard } from '@/core/hud';
import type { IACPMessageBus } from '@/core/protocols';
import { createACPMessage } from '@/core/protocols';
import { ServiceRegistry } from '@/core/services/service-registry';
import type { OrchestratorRunner } from '@/core/orchestrator/orchestrator-runner';

export interface DashboardAPIOptions {
  server: IWebServer;
  dashboard?: IHUDDashboard;
  messageBus?: IACPMessageBus;
  sseBroker?: SSEBroker;
  /** Optional runner reference for pool/background stats */
  runner?: OrchestratorRunner;
}

export class DashboardAPI {
  private readonly server: IWebServer;
  private readonly dashboard: IHUDDashboard | null;
  private readonly messageBus: IACPMessageBus | null;
  private readonly sseBroker: SSEBroker | null;
  private readonly runner: OrchestratorRunner | null;

  constructor(options: DashboardAPIOptions) {
    this.server = options.server;
    this.dashboard = options.dashboard ?? null;
    this.messageBus = options.messageBus ?? null;
    this.sseBroker = options.sseBroker ?? null;
    this.runner = options.runner ?? null;
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.server.addRoute('GET', '/api/health', this.handleHealth.bind(this));
    this.server.addRoute('GET', '/api/snapshot', this.handleSnapshot.bind(this));
    this.server.addRoute('GET', '/api/agents', this.handleAgents.bind(this));
    this.server.addRoute('GET', '/api/agents/:agentId', this.handleAgentById.bind(this));
    this.server.addRoute('POST', '/api/tasks', this.handleSubmitTask.bind(this));
    this.server.addRoute('GET', '/api/sse/clients', this.handleSSEClients.bind(this));
    this.server.addRoute('GET', '/api/mcp/servers', this.handleMCPServers.bind(this));
    this.server.addRoute('GET', '/api/pool/stats', this.handlePoolStats.bind(this));
  }

  private async handleHealth(_req: WebRequest): Promise<WebResponse> {
    if (!this.dashboard) {
      return { status: 200, body: { status: 'ok', health: 100 } };
    }
    const snapshot = this.dashboard.snapshot();
    const health = snapshot.systemHealth;
    return {
      status: 200,
      body: {
        status: health >= 70 ? 'healthy' : health >= 40 ? 'degraded' : 'unhealthy',
        health,
      },
    };
  }

  private async handleSnapshot(_req: WebRequest): Promise<WebResponse> {
    if (!this.dashboard) {
      return { status: 503, body: { error: 'Dashboard not configured' } };
    }
    const snapshot = this.dashboard.snapshot();
    return { status: 200, body: snapshot };
  }

  private async handleAgents(_req: WebRequest): Promise<WebResponse> {
    if (!this.dashboard) {
      return { status: 503, body: { error: 'Dashboard not configured' } };
    }
    const snapshot = this.dashboard.snapshot();
    return { status: 200, body: { agents: snapshot.agents } };
  }

  private async handleAgentById(req: WebRequest): Promise<WebResponse> {
    if (!this.dashboard) {
      return { status: 503, body: { error: 'Dashboard not configured' } };
    }
    const snapshot = this.dashboard.snapshot();
    const agent = snapshot.agents.find(a => a.agentId === req.params.agentId);
    if (!agent) {
      return { status: 404, body: { error: 'Agent not found' } };
    }
    return { status: 200, body: agent };
  }

  private async handleSubmitTask(req: WebRequest): Promise<WebResponse> {
    if (!this.messageBus) {
      return { status: 503, body: { error: 'Message bus not configured' } };
    }
    const body = req.body as { name?: string; description?: string } | undefined;
    if (!body?.name) {
      return { status: 400, body: { error: 'Task name is required' } };
    }
    const msg = createACPMessage({
      type: 'task:submit',
      source: 'web-dashboard',
      target: 'orchestrator',
      payload: { name: body.name, description: body.description ?? '' },
    });
    await this.messageBus.publish(msg);
    return { status: 202, body: { taskId: msg.id, status: 'accepted' } };
  }

  private async handleSSEClients(_req: WebRequest): Promise<WebResponse> {
    if (!this.sseBroker) {
      return { status: 200, body: { clients: 0 } };
    }
    return { status: 200, body: { clients: this.sseBroker.getClientCount() } };
  }

  private async handleMCPServers(_req: WebRequest): Promise<WebResponse> {
    const manager = ServiceRegistry.getInstance().getMCPConnectionManager();
    if (!manager) {
      return { status: 200, body: { servers: [], enabled: false, totalTools: 0 } };
    }
    return {
      status: 200,
      body: {
        enabled: true,
        servers: manager.getStatus(),
        totalTools: manager.getAllTools().length,
      },
    };
  }

  private async handlePoolStats(_req: WebRequest): Promise<WebResponse> {
    const pool = this.runner?.getAgentPool();
    if (!pool) {
      return { status: 200, body: { enabled: false } };
    }
    return {
      status: 200,
      body: {
        enabled: true,
        ...pool.stats(),
        backgroundTasks: this.runner?.getBackgroundTasks()?.length ?? 0,
      },
    };
  }

  getServer(): IWebServer {
    return this.server;
  }
}

export function createDashboardAPI(options: DashboardAPIOptions): DashboardAPI {
  return new DashboardAPI(options);
}
