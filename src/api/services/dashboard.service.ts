/**
 * Dashboard API Service
 *
 * Service layer for Dashboard statistics and real-time activity tracking.
 * Aggregates data from AgentsService, WorkflowsService, and EventBus.
 */

import { createLogger, ILogger } from '../../core/services/logger.js';
import { IAsyncEventBus, IEvent, SystemEvents, Subscription } from '../../core/interfaces/event.interface.js';
import { AgentsService, AgentInfo } from './agents.service.js';
import { WorkflowsService, WorkflowInfo } from './workflows.service.js';

/**
 * Dashboard statistics structure
 */
export interface DashboardStats {
  projects: {
    total: number;
    active: number;
  };
  workflows: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  };
  agents: {
    total: number;
    online: number;
    busy: number;
  };
  recentActivity: ActivityItem[];
}

/**
 * Activity item for recent activity feed
 */
export interface ActivityItem {
  id: string;
  type: 'agent' | 'workflow' | 'task' | 'system';
  action: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dashboard Service
 *
 * Provides aggregated statistics and activity tracking for the dashboard.
 */
export class DashboardService {
  private readonly logger: ILogger;
  private readonly recentActivities: ActivityItem[] = [];
  private readonly maxActivities = 50;
  private readonly subscriptions: Subscription[] = [];
  private readonly agentsService: AgentsService;
  private readonly workflowsService: WorkflowsService;
  private readonly eventBus?: IAsyncEventBus;

  constructor(
    agentsService: AgentsService,
    workflowsService: WorkflowsService,
    eventBus?: IAsyncEventBus
  ) {
    this.logger = createLogger('DashboardService');
    this.agentsService = agentsService;
    this.workflowsService = workflowsService;
    this.eventBus = eventBus;

    if (this.eventBus) {
      this.setupEventSubscriptions();
    }

    this.logger.info('DashboardService initialized');
  }

  /**
   * Helper to safely extract payload properties from events
   */
  private getPayloadValue(payload: unknown, key: string): string {
    if (payload && typeof payload === 'object' && key in payload) {
      return String((payload as Record<string, unknown>)[key]);
    }
    return 'unknown';
  }

  /**
   * Set up event subscriptions for activity tracking
   */
  private setupEventSubscriptions(): void {
    if (!this.eventBus) return;

    // Agent events
    this.subscriptions.push(
      this.eventBus.on(SystemEvents.AgentStarted, (event: IEvent) => {
        const name = this.getPayloadValue(event.payload, 'name');
        const agentId = this.getPayloadValue(event.payload, 'agentId');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'agent',
          action: 'started',
          description: `Agent "${name !== 'unknown' ? name : agentId}" started`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    this.subscriptions.push(
      this.eventBus.on(SystemEvents.AgentStopped, (event: IEvent) => {
        const agentId = this.getPayloadValue(event.payload, 'agentId');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'agent',
          action: 'stopped',
          description: `Agent "${agentId}" stopped`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    // Workflow events
    this.subscriptions.push(
      this.eventBus.on(SystemEvents.WorkflowStarted, (event: IEvent) => {
        const workflowId = this.getPayloadValue(event.payload, 'workflowId');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'workflow',
          action: 'started',
          description: `Workflow "${workflowId}" started`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    this.subscriptions.push(
      this.eventBus.on(SystemEvents.WorkflowCompleted, (event: IEvent) => {
        const workflowId = this.getPayloadValue(event.payload, 'workflowId');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'workflow',
          action: 'completed',
          description: `Workflow "${workflowId}" completed`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    this.subscriptions.push(
      this.eventBus.on(SystemEvents.WorkflowFailed, (event: IEvent) => {
        const workflowId = this.getPayloadValue(event.payload, 'workflowId');
        const error = this.getPayloadValue(event.payload, 'error');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'workflow',
          action: 'failed',
          description: `Workflow "${workflowId}" failed: ${error !== 'unknown' ? error : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    // Task events
    this.subscriptions.push(
      this.eventBus.on(SystemEvents.TaskCompleted, (event: IEvent) => {
        const taskId = this.getPayloadValue(event.payload, 'taskId');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'task',
          action: 'completed',
          description: `Task "${taskId}" completed`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    this.subscriptions.push(
      this.eventBus.on(SystemEvents.TaskFailed, (event: IEvent) => {
        const taskId = this.getPayloadValue(event.payload, 'taskId');
        const error = this.getPayloadValue(event.payload, 'error');
        this.addActivity({
          id: crypto.randomUUID(),
          type: 'task',
          action: 'failed',
          description: `Task "${taskId}" failed: ${error !== 'unknown' ? error : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          metadata: event.payload as Record<string, unknown>,
        });
      })
    );

    this.logger.debug('Event subscriptions set up', { count: this.subscriptions.length });
  }

  /**
   * Add an activity to the recent activities list
   */
  private addActivity(activity: ActivityItem): void {
    this.recentActivities.unshift(activity);

    // Limit the number of stored activities
    if (this.recentActivities.length > this.maxActivities) {
      this.recentActivities.pop();
    }

    this.logger.debug('Activity added', { type: activity.type, action: activity.action });
  }

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    // Get agents data
    const agentsResult = await this.agentsService.listAgents({ limit: 1000 });
    const agents = agentsResult.agents;

    // Calculate agent statistics
    const agentStats = this.calculateAgentStats(agents);

    // Get workflows data
    const workflowsResult = await this.workflowsService.listWorkflows({ limit: 1000 });
    const workflows = workflowsResult.workflows;

    // Calculate workflow statistics
    const workflowStats = this.calculateWorkflowStats(workflows);

    // Get recent activities (last 20)
    const recentActivity = this.recentActivities.slice(0, 20);

    return {
      projects: {
        total: 0,  // Projects not yet implemented
        active: 0,
      },
      workflows: workflowStats,
      agents: agentStats,
      recentActivity,
    };
  }

  /**
   * Calculate agent statistics
   */
  private calculateAgentStats(agents: AgentInfo[]): DashboardStats['agents'] {
    const total = agents.length;
    let online = 0;
    let busy = 0;

    for (const agent of agents) {
      // Agent is considered online if not stopped or error
      if (agent.status !== 'stopped' && agent.status !== 'error') {
        online++;
      }
      // Agent is considered busy if processing
      if (agent.status === 'processing' || agent.currentTask !== null) {
        busy++;
      }
    }

    return { total, online, busy };
  }

  /**
   * Calculate workflow statistics
   */
  private calculateWorkflowStats(workflows: WorkflowInfo[]): DashboardStats['workflows'] {
    const total = workflows.length;
    let running = 0;
    let completed = 0;
    let failed = 0;

    for (const workflow of workflows) {
      switch (workflow.status) {
        case 'active':
          running++;
          break;
        case 'archived':
          // Consider archived as completed for stats purposes
          completed++;
          break;
        case 'draft':
        case 'paused':
          // These don't contribute to running/completed/failed counts
          break;
      }
    }

    return { total, running, completed, failed };
  }

  /**
   * Get recent activity items
   */
  async getRecentActivity(limit = 20): Promise<ActivityItem[]> {
    return this.recentActivities.slice(0, limit);
  }

  /**
   * Add a manual activity (for external components)
   */
  recordActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>): void {
    this.addActivity({
      ...activity,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;
    this.logger.info('DashboardService disposed');
  }
}

/**
 * Create dashboard service instance
 */
export function createDashboardService(
  agentsService: AgentsService,
  workflowsService: WorkflowsService,
  eventBus?: IAsyncEventBus
): DashboardService {
  return new DashboardService(agentsService, workflowsService, eventBus);
}
