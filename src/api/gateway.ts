/**
 * API Gateway
 *
 * Unified entry point for external access to the agent system.
 * Bridges HTTP/WS requests to ACP messages.
 *
 * @module api
 */

import type {
  IACPMessageBus,
  TaskSubmitPayload,
  TaskStatusPayload,
  TaskResultPayload,
  SystemHealthPayload,
} from '../core/protocols';
import { createACPMessage } from '../core/protocols';

/**
 * Gateway event handler
 */
export type GatewayEventHandler = (event: GatewayEvent) => void;

/**
 * Gateway event
 */
export interface GatewayEvent {
  type: 'task:submitted' | 'task:completed' | 'task:failed' | 'system:health';
  data: unknown;
  timestamp: string;
}

/**
 * API Gateway options
 */
export interface APIGatewayOptions {
  /** ACP message bus to use */
  messageBus: IACPMessageBus;
  /** Gateway identifier */
  gatewayId?: string;
  /** Health check timeout in ms */
  healthTimeout?: number;
}

/**
 * Task submission request
 */
export interface SubmitTaskRequest {
  description: string;
  type?: string;
  targetTeam?: string;
  projectContext?: string;
  config?: Record<string, unknown>;
}

/**
 * Task submission response
 */
export interface SubmitTaskResponse {
  taskId: string;
  status: 'accepted';
  message: string;
}

/**
 * API Gateway — external access to the agent system
 */
export class APIGateway {
  private readonly bus: IACPMessageBus;
  private readonly gatewayId: string;
  private readonly healthTimeout: number;
  private readonly eventHandlers: GatewayEventHandler[] = [];
  private taskCounter = 0;

  constructor(options: APIGatewayOptions) {
    this.bus = options.messageBus;
    this.gatewayId = options.gatewayId ?? 'api-gateway';
    this.healthTimeout = options.healthTimeout ?? 5000;

    // Subscribe to task results for event forwarding
    this.bus.on('task:result', async (msg) => {
      this.emitEvent({
        type: (msg.payload as TaskResultPayload).success
          ? 'task:completed'
          : 'task:failed',
        data: msg.payload,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Submit a task to the agent system
   */
  async submitTask(request: SubmitTaskRequest): Promise<SubmitTaskResponse> {
    const taskId = `task-${++this.taskCounter}-${Date.now()}`;

    const payload: TaskSubmitPayload = {
      description: request.description,
      type: request.type,
      targetTeam: request.targetTeam,
      projectContext: request.projectContext,
      config: request.config,
    };

    const message = createACPMessage({
      type: 'task:submit',
      source: this.gatewayId,
      target: request.targetTeam ?? 'orchestrator',
      payload,
      metadata: { taskId },
    });

    await this.bus.publish(message);

    return {
      taskId,
      status: 'accepted',
      message: `Task '${request.description}' submitted`,
    };
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<SystemHealthPayload> {
    const message = createACPMessage<Record<string, never>>({
      type: 'system:health',
      source: this.gatewayId,
      target: 'system',
      payload: {},
    });

    try {
      const response = await this.bus.request<Record<string, never>, SystemHealthPayload>(
        message,
        this.healthTimeout,
      );
      return response.payload;
    } catch {
      // If no system component responds, return degraded status
      return {
        status: 'degraded',
        activeAgents: 0,
        pendingTasks: 0,
        uptime: 0,
        components: {},
      };
    }
  }

  /**
   * Publish a task status update
   */
  async publishStatus(status: TaskStatusPayload): Promise<void> {
    const message = createACPMessage({
      type: 'task:status',
      source: this.gatewayId,
      target: 'broadcast',
      payload: status,
    });

    await this.bus.publish(message);
  }

  /**
   * Register an event handler for gateway events
   */
  onEvent(handler: GatewayEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  private emitEvent(event: GatewayEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}

/**
 * Factory function
 */
export function createAPIGateway(options: APIGatewayOptions): APIGateway {
  return new APIGateway(options);
}
