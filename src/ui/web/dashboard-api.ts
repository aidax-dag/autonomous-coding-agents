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
import { CostReporter } from '@/core/analytics/cost-reporter';
import type { OrchestratorRunner } from '@/core/orchestrator/orchestrator-runner';
import type { ExportOptions, ExportedInstinctBundle } from '@/core/learning/instinct-export';
import type { ImportOptions } from '@/core/learning/instinct-import';
import { InstinctBundleExporter } from '@/core/learning/instinct-export';
import { InstinctBundleImporter } from '@/core/learning/instinct-import';

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
    this.server.addRoute('GET', '/api/instincts', this.handleListInstincts.bind(this));
    this.server.addRoute('POST', '/api/instincts/export', this.handleExportInstincts.bind(this));
    this.server.addRoute('POST', '/api/instincts/import', this.handleImportInstincts.bind(this));
    this.server.addRoute('GET', '/api/analytics/summary', this.handleAnalyticsSummary.bind(this));
    this.server.addRoute('GET', '/api/analytics/cost-report', this.handleAnalyticsCostReport.bind(this));
    this.server.addRoute('GET', '/api/collaboration/sessions', this.handleListCollaborationSessions.bind(this));
    this.server.addRoute('POST', '/api/collaboration/sessions', this.handleCreateCollaborationSession.bind(this));
    this.server.addRoute('POST', '/api/collaboration/sessions/:id/join', this.handleJoinCollaborationSession.bind(this));
    this.server.addRoute('POST', '/api/collaboration/sessions/:id/leave', this.handleLeaveCollaborationSession.bind(this));
    this.server.addRoute('POST', '/api/collaboration/sessions/:id/messages', this.handleSendCollaborationMessage.bind(this));
    this.server.addRoute('GET', '/api/collaboration/sessions/:id/messages', this.handleGetCollaborationMessages.bind(this));
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

  private async handleListInstincts(_req: WebRequest): Promise<WebResponse> {
    const store = ServiceRegistry.getInstance().getInstinctStore();
    if (!store) {
      return { status: 200, body: { enabled: false, instincts: [] } };
    }
    const instincts = await store.list();
    return {
      status: 200,
      body: { enabled: true, count: instincts.length, instincts },
    };
  }

  private async handleExportInstincts(req: WebRequest): Promise<WebResponse> {
    const store = ServiceRegistry.getInstance().getInstinctStore();
    if (!store) {
      return { status: 503, body: { error: 'Instinct store not configured' } };
    }
    const options = (req.body as ExportOptions | undefined) ?? {};
    const allInstincts = await store.list();
    const bundleStore = { getAll: () => allInstincts };
    const exporter = new InstinctBundleExporter(bundleStore);
    const bundle = exporter.export(options);
    return { status: 200, body: bundle };
  }

  private async handleImportInstincts(req: WebRequest): Promise<WebResponse> {
    const store = ServiceRegistry.getInstance().getInstinctStore();
    if (!store) {
      return { status: 503, body: { error: 'Instinct store not configured' } };
    }
    const body = req.body as { bundle?: ExportedInstinctBundle; options?: ImportOptions } | undefined;
    if (!body?.bundle) {
      return { status: 400, body: { error: 'Bundle is required in request body' } };
    }
    const allInstincts = await store.list();
    const importStore = {
      getAll: () => allInstincts.map((i) => ({ trigger: i.trigger })),
      add: (instinct: Record<string, unknown>) => {
        store.create({
          trigger: instinct.pattern as string,
          action: instinct.action as string,
          confidence: instinct.confidence as number,
          domain: (instinct.category as string) === 'general' ? 'custom' : (instinct.category as string) as never,
          source: 'imported',
          evidence: [],
        });
      },
    };
    const importer = new InstinctBundleImporter(importStore);
    const result = importer.import(body.bundle, body.options);
    return { status: 200, body: result };
  }

  private async handleAnalyticsSummary(req: WebRequest): Promise<WebResponse> {
    const tracker = ServiceRegistry.getInstance().getUsageTracker();
    if (!tracker) {
      return { status: 200, body: { enabled: false } };
    }
    const summary = tracker.getSummary({
      since: req.query.since,
      until: req.query.until,
    });
    return { status: 200, body: { enabled: true, ...summary } };
  }

  private async handleAnalyticsCostReport(req: WebRequest): Promise<WebResponse> {
    const tracker = ServiceRegistry.getInstance().getUsageTracker();
    if (!tracker) {
      return { status: 200, body: { enabled: false } };
    }
    const reporter = new CostReporter(tracker);
    const report = reporter.generateReport({
      since: req.query.since,
      until: req.query.until,
    });
    return { status: 200, body: { enabled: true, ...report } };
  }

  private async handleListCollaborationSessions(_req: WebRequest): Promise<WebResponse> {
    const hub = ServiceRegistry.getInstance().getCollaborationHub();
    if (!hub) {
      return { status: 200, body: { enabled: false, sessions: [] } };
    }
    const sessions = hub.listSessions();
    return { status: 200, body: { enabled: true, sessions } };
  }

  private async handleCreateCollaborationSession(req: WebRequest): Promise<WebResponse> {
    const hub = ServiceRegistry.getInstance().getCollaborationHub();
    if (!hub) {
      return { status: 503, body: { error: 'Collaboration not configured' } };
    }
    const body = req.body as { id?: string; name?: string; createdBy?: string } | undefined;
    if (!body?.id || !body?.name || !body?.createdBy) {
      return { status: 400, body: { error: 'id, name, and createdBy are required' } };
    }
    const session = hub.createSession(body.id, body.name, body.createdBy);
    return { status: 201, body: session };
  }

  private async handleJoinCollaborationSession(req: WebRequest): Promise<WebResponse> {
    const hub = ServiceRegistry.getInstance().getCollaborationHub();
    if (!hub) {
      return { status: 503, body: { error: 'Collaboration not configured' } };
    }
    const body = req.body as { userId?: string } | undefined;
    if (!body?.userId) {
      return { status: 400, body: { error: 'userId is required' } };
    }
    const session = hub.joinSession(req.params.id, body.userId);
    if (!session) {
      return { status: 404, body: { error: 'Session not found or inactive' } };
    }
    return { status: 200, body: session };
  }

  private async handleLeaveCollaborationSession(req: WebRequest): Promise<WebResponse> {
    const hub = ServiceRegistry.getInstance().getCollaborationHub();
    if (!hub) {
      return { status: 503, body: { error: 'Collaboration not configured' } };
    }
    const body = req.body as { userId?: string } | undefined;
    if (!body?.userId) {
      return { status: 400, body: { error: 'userId is required' } };
    }
    const left = hub.leaveSession(req.params.id, body.userId);
    if (!left) {
      return { status: 404, body: { error: 'Session not found' } };
    }
    return { status: 200, body: { success: true } };
  }

  private async handleSendCollaborationMessage(req: WebRequest): Promise<WebResponse> {
    const hub = ServiceRegistry.getInstance().getCollaborationHub();
    if (!hub) {
      return { status: 503, body: { error: 'Collaboration not configured' } };
    }
    const body = req.body as { type?: string; senderId?: string; payload?: unknown } | undefined;
    if (!body?.type || !body?.senderId) {
      return { status: 400, body: { error: 'type and senderId are required' } };
    }
    hub.broadcast({
      type: body.type as 'cursor' | 'edit' | 'chat' | 'status' | 'task-update' | 'agent-event',
      senderId: body.senderId,
      sessionId: req.params.id,
      payload: body.payload ?? null,
      timestamp: new Date().toISOString(),
    });
    return { status: 202, body: { status: 'sent' } };
  }

  private async handleGetCollaborationMessages(req: WebRequest): Promise<WebResponse> {
    const hub = ServiceRegistry.getInstance().getCollaborationHub();
    if (!hub) {
      return { status: 200, body: { enabled: false, messages: [] } };
    }
    const messages = hub.getMessageHistory(req.params.id);
    return { status: 200, body: { enabled: true, messages } };
  }

  getServer(): IWebServer {
    return this.server;
  }
}

export function createDashboardAPI(options: DashboardAPIOptions): DashboardAPI {
  return new DashboardAPI(options);
}
