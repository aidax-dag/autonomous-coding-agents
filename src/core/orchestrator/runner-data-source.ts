/**
 * Runner Data Source
 *
 * Bridges OrchestratorRunner events to ACP messages so that
 * TUI components and Web dashboards can subscribe to real-time
 * runner state through the unified message bus.
 *
 * @module core/orchestrator
 */

import type { IACPMessageBus } from '../protocols/interfaces/acp.interface';
import { createACPMessage } from '../protocols/acp-message-bus';
import type { OrchestratorRunner, WorkflowResult, GoalResult } from './orchestrator-runner';

/**
 * Runner data source configuration
 */
export interface RunnerDataSourceConfig {
  /** The orchestrator runner to observe */
  runner: OrchestratorRunner;
  /** The ACP message bus to publish to */
  messageBus: IACPMessageBus;
  /** Source identifier for messages (default: 'runner') */
  sourceId?: string;
}

/**
 * RunnerDataSource — listens to OrchestratorRunner events and
 * publishes corresponding ACP messages for UI consumption.
 */
export class RunnerDataSource {
  private readonly runner: OrchestratorRunner;
  private readonly bus: IACPMessageBus;
  private readonly sourceId: string;
  private connected = false;
  private cleanupFns: Array<() => void> = [];

  constructor(config: RunnerDataSourceConfig) {
    this.runner = config.runner;
    this.bus = config.messageBus;
    this.sourceId = config.sourceId ?? 'runner';
  }

  /**
   * Start listening to runner events and publishing ACP messages.
   */
  connect(): void {
    if (this.connected) return;
    this.connected = true;

    // workflow:started → task:status (running)
    const onWorkflowStarted = (taskId: string) => {
      this.bus.publish(
        createACPMessage({
          type: 'task:status',
          source: this.sourceId,
          target: 'broadcast',
          payload: { taskId, status: 'running', progress: 0 },
        }),
      );
    };
    this.runner.on('workflow:started', onWorkflowStarted);
    this.cleanupFns.push(() => this.runner.removeListener('workflow:started', onWorkflowStarted));

    // workflow:completed → task:result
    const onWorkflowCompleted = (result: WorkflowResult) => {
      this.bus.publish(
        createACPMessage({
          type: 'task:result',
          source: this.sourceId,
          target: 'broadcast',
          payload: {
            taskId: result.taskId,
            success: result.success,
            result: result.result,
            error: result.error,
            duration: result.duration,
          },
        }),
      );
      // Also publish task:status (completed/failed)
      this.bus.publish(
        createACPMessage({
          type: 'task:status',
          source: this.sourceId,
          target: 'broadcast',
          payload: {
            taskId: result.taskId,
            status: result.success ? 'completed' : 'failed',
            progress: result.success ? 100 : 0,
            message: result.error,
          },
        }),
      );
    };
    this.runner.on('workflow:completed', onWorkflowCompleted);
    this.cleanupFns.push(() => this.runner.removeListener('workflow:completed', onWorkflowCompleted));

    // workflow:failed → task:status (failed)
    const onWorkflowFailed = (taskId: string, error: Error) => {
      this.bus.publish(
        createACPMessage({
          type: 'task:status',
          source: this.sourceId,
          target: 'broadcast',
          payload: { taskId, status: 'failed', progress: 0, message: error.message },
        }),
      );
    };
    this.runner.on('workflow:failed', onWorkflowFailed);
    this.cleanupFns.push(() => this.runner.removeListener('workflow:failed', onWorkflowFailed));

    // goal:started → agent:event
    const onGoalStarted = (goalId: string) => {
      this.bus.publish(
        createACPMessage({
          type: 'agent:event',
          source: this.sourceId,
          target: 'broadcast',
          payload: { event: 'goal:started', goalId },
        }),
      );
    };
    this.runner.on('goal:started', onGoalStarted);
    this.cleanupFns.push(() => this.runner.removeListener('goal:started', onGoalStarted));

    // goal:completed → agent:event
    const onGoalCompleted = (result: GoalResult) => {
      this.bus.publish(
        createACPMessage({
          type: 'agent:event',
          source: this.sourceId,
          target: 'broadcast',
          payload: {
            event: 'goal:completed',
            goalId: result.goalId,
            success: result.success,
            completedTasks: result.completedTasks,
            failedTasks: result.failedTasks,
            totalDuration: result.totalDuration,
          },
        }),
      );
    };
    this.runner.on('goal:completed', onGoalCompleted);
    this.cleanupFns.push(() => this.runner.removeListener('goal:completed', onGoalCompleted));

    // started/stopped → system:health
    const onStarted = () => {
      this.bus.publish(
        createACPMessage({
          type: 'system:health',
          source: this.sourceId,
          target: 'broadcast',
          payload: { status: 'healthy', event: 'runner:started' },
        }),
      );
    };
    this.runner.on('started', onStarted);
    this.cleanupFns.push(() => this.runner.removeListener('started', onStarted));

    const onStopped = () => {
      this.bus.publish(
        createACPMessage({
          type: 'system:health',
          source: this.sourceId,
          target: 'broadcast',
          payload: { status: 'unhealthy', event: 'runner:stopped' },
        }),
      );
    };
    this.runner.on('stopped', onStopped);
    this.cleanupFns.push(() => this.runner.removeListener('stopped', onStopped));

    // error → system:health (degraded)
    const onError = (error: Error) => {
      this.bus.publish(
        createACPMessage({
          type: 'system:health',
          source: this.sourceId,
          target: 'broadcast',
          payload: { status: 'degraded', event: 'runner:error', error: error.message },
        }),
      );
    };
    this.runner.on('error', onError);
    this.cleanupFns.push(() => this.runner.removeListener('error', onError));
  }

  /**
   * Stop listening and clean up all subscriptions.
   */
  disconnect(): void {
    if (!this.connected) return;
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Factory function
 */
export function createRunnerDataSource(config: RunnerDataSourceConfig): RunnerDataSource {
  return new RunnerDataSource(config);
}
