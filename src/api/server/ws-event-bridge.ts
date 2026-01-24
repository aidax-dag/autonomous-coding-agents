/**
 * WebSocket Event Bridge
 *
 * Bridges EventBus events to WebSocket clients.
 *
 * @module api/server/ws-event-bridge
 */

import { IAsyncEventBus, IEvent, SystemEvents, Subscription } from '../../core/interfaces/event.interface.js';
import { IWsServer } from '../interfaces/ws.interface.js';
import { WsEventType } from '../interfaces/ws-events.js';
import { ILogger } from '../../core/services/logger.interface.js';
import { createLogger } from '../../core/services/logger.js';

/**
 * Map of SystemEvents to WsEventTypes
 */
const EVENT_TYPE_MAP: Record<string, WsEventType> = {
  [SystemEvents.AgentStarted]: WsEventType.AGENT_STARTED,
  [SystemEvents.AgentStopped]: WsEventType.AGENT_STOPPED,
  [SystemEvents.AgentError]: WsEventType.AGENT_ERROR,
  [SystemEvents.TaskStarted]: WsEventType.AGENT_TASK_ASSIGNED,
  [SystemEvents.TaskCompleted]: WsEventType.AGENT_TASK_COMPLETED,
  [SystemEvents.TaskFailed]: WsEventType.AGENT_TASK_FAILED,
  [SystemEvents.WorkflowStarted]: WsEventType.WORKFLOW_STARTED,
  [SystemEvents.WorkflowCompleted]: WsEventType.WORKFLOW_COMPLETED,
  [SystemEvents.WorkflowFailed]: WsEventType.WORKFLOW_FAILED,
  [SystemEvents.WorkflowStepStarted]: WsEventType.WORKFLOW_STEP_STARTED,
  [SystemEvents.WorkflowStepCompleted]: WsEventType.WORKFLOW_STEP_COMPLETED,
  [SystemEvents.WorkflowStepFailed]: WsEventType.WORKFLOW_STEP_FAILED,
  [SystemEvents.SystemHealthCheck]: WsEventType.SYSTEM_HEALTH,
  [SystemEvents.SystemMetrics]: WsEventType.SYSTEM_METRICS,
  [SystemEvents.SystemError]: WsEventType.SYSTEM_ALERT,
};

/**
 * WebSocket Event Bridge
 *
 * Subscribes to EventBus events and broadcasts them to WebSocket clients.
 */
export class WsEventBridge {
  private readonly logger: ILogger;
  private readonly subscriptions: Subscription[] = [];
  private healthBroadcastInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly eventBus: IAsyncEventBus,
    private readonly wsServer: IWsServer
  ) {
    this.logger = createLogger('WsEventBridge');
  }

  /**
   * Start the event bridge
   */
  start(): void {
    this.subscribeToEvents();
    this.startHealthBroadcast();
    this.logger.info('WebSocket event bridge started');
  }

  /**
   * Stop the event bridge
   */
  stop(): void {
    // Unsubscribe from all events
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;

    // Stop health broadcast
    if (this.healthBroadcastInterval) {
      clearInterval(this.healthBroadcastInterval);
      this.healthBroadcastInterval = null;
    }

    this.logger.info('WebSocket event bridge stopped');
  }

  /**
   * Subscribe to EventBus events
   */
  private subscribeToEvents(): void {
    // Subscribe to all mapped events
    for (const [systemEvent, wsEventType] of Object.entries(EVENT_TYPE_MAP)) {
      const subscription = this.eventBus.on(
        systemEvent,
        (event: IEvent) => {
          this.broadcastEvent(wsEventType, event);
        }
      );
      this.subscriptions.push(subscription);
    }

    this.logger.debug('Event subscriptions created', {
      count: this.subscriptions.length,
    });
  }

  /**
   * Broadcast an event to WebSocket clients
   */
  private broadcastEvent(eventType: WsEventType, event: IEvent): void {
    const payload = this.transformPayload(eventType, event);

    this.wsServer.broadcastEvent(eventType, payload).catch((error) => {
      this.logger.error('Failed to broadcast event', {
        eventType,
        error: (error as Error).message,
      });
    });

    this.logger.debug('Event broadcasted', {
      eventType,
      source: event.source,
    });
  }

  /**
   * Transform event payload to match WebSocket event format
   */
  private transformPayload(eventType: WsEventType, event: IEvent): unknown {
    const payload = event.payload as Record<string, unknown>;

    // Add common fields
    const basePayload = {
      ...payload,
      timestamp: event.timestamp.toISOString(),
    };

    // Transform based on event type
    switch (eventType) {
      case WsEventType.AGENT_STARTED:
      case WsEventType.AGENT_STOPPED:
        return {
          agentId: payload.agentId || event.metadata?.agentId,
          agentName: payload.name || payload.agentName || 'Unknown',
          agentType: payload.agentType || 'unknown',
          status: eventType === WsEventType.AGENT_STARTED ? 'running' : 'stopped',
          reason: payload.reason,
        };

      case WsEventType.AGENT_TASK_COMPLETED:
        return {
          agentId: payload.agentId || event.metadata?.agentId,
          taskId: payload.taskId,
          taskName: payload.taskName || 'Task',
          duration: payload.duration || 0,
          success: payload.success ?? true,
          result: payload.result,
        };

      case WsEventType.AGENT_TASK_FAILED:
        return {
          agentId: payload.agentId || event.metadata?.agentId,
          taskId: payload.taskId,
          taskName: payload.taskName || 'Task',
          error: payload.error || 'Unknown error',
          recoverable: payload.recoverable ?? false,
        };

      case WsEventType.WORKFLOW_STARTED:
        return {
          workflowId: payload.workflowId,
          workflowName: payload.workflowName || 'Workflow',
          status: 'running',
          totalSteps: payload.totalSteps || 0,
        };

      case WsEventType.WORKFLOW_COMPLETED:
        return {
          workflowId: payload.workflowId,
          workflowName: payload.workflowName || 'Workflow',
          status: 'completed',
          duration: payload.duration || 0,
          stepsCompleted: payload.stepsCompleted || 0,
        };

      case WsEventType.WORKFLOW_FAILED:
        return {
          workflowId: payload.workflowId,
          workflowName: payload.workflowName || 'Workflow',
          status: 'failed',
          error: payload.error || 'Unknown error',
          failedStep: payload.failedStep,
        };

      case WsEventType.SYSTEM_ALERT:
        return {
          level: payload.level || 'error',
          message: payload.message || payload.error || 'System error',
          source: event.source,
          details: payload.details || payload,
        };

      default:
        return basePayload;
    }
  }

  /**
   * Start periodic health broadcast
   */
  private startHealthBroadcast(): void {
    const HEALTH_INTERVAL = 30000; // 30 seconds

    this.healthBroadcastInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const healthPayload = {
        status: 'healthy' as const,
        uptime: process.uptime(),
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        activeConnections: this.wsServer.getConnectionCount(),
      };

      this.wsServer.broadcastEvent(WsEventType.SYSTEM_HEALTH, healthPayload).catch((error) => {
        this.logger.warn('Failed to broadcast health', {
          error: (error as Error).message,
        });
      });
    }, HEALTH_INTERVAL);
  }
}

/**
 * Create WebSocket event bridge
 */
export function createWsEventBridge(
  eventBus: IAsyncEventBus,
  wsServer: IWsServer
): WsEventBridge {
  return new WsEventBridge(eventBus, wsServer);
}
