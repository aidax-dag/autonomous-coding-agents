/**
 * Orchestrator Module
 *
 * Provides agent coordination, task distribution, and workflow orchestration.
 *
 * @module core/orchestrator
 *
 * @example
 * ```typescript
 * import {
 *   OrchestratorService,
 *   createOrchestrator,
 *   RoutingStrategy,
 *   OrchestratorEvents,
 * } from '@core/orchestrator';
 *
 * // Create orchestrator with least-loaded routing
 * const orchestrator = createOrchestrator(agentRegistry, eventBus, {
 *   routingStrategy: RoutingStrategy.LEAST_LOADED,
 *   maxConcurrentTasks: 10,
 *   taskTimeout: 60000,
 * });
 *
 * // Start the orchestrator
 * await orchestrator.start();
 *
 * // Subscribe to events
 * orchestrator.on(OrchestratorEvents.TASK_COMPLETED, (payload) => {
 *   console.log(`Task ${payload.taskId} completed`);
 * });
 *
 * // Submit a task
 * const taskId = await orchestrator.submitTask(task);
 *
 * // Get statistics
 * const stats = orchestrator.getStats();
 * console.log(`Processed: ${stats.totalProcessed}, Failed: ${stats.failedTasks}`);
 * ```
 */

export {
  // Service
  OrchestratorService,
  createOrchestrator,

  // Enums
  RoutingStrategy,
  OrchestratorStatus,
  QueuedTaskStatus,

  // Events
  OrchestratorEvents,

  // Schemas
  OrchestratorConfigSchema,

  // Types
  type QueuedTask,
  type TaskAssignment,
  type OrchestratorConfig,
  type OrchestratorStats,
  type OrchestratorEventType,
  type OrchestratorEventPayload,
  type IOrchestrator,
} from './orchestrator-service';
