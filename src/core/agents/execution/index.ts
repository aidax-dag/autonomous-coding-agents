/**
 * Agent Execution Module
 *
 * Provides execution infrastructure for agents including:
 * - Background execution with lifecycle management
 * - Job tracking and monitoring
 * - Event-based progress updates
 *
 * @module core/agents/execution
 */

export {
  // Main class
  BackgroundExecutor,
  createBackgroundExecutor,
  submitBackgroundJob,
  // Enums
  BackgroundJobStatus,
  // Schemas
  BackgroundJobOptionsSchema,
  BackgroundExecutorConfigSchema,
  // Events
  BackgroundExecutorEvents,
  // Types
  type BackgroundJob,
  type BackgroundJobOptions,
  type BackgroundExecutorConfig,
  type IBackgroundExecutor,
  type BackgroundExecutorStats,
  type BackgroundJobEventPayload,
  type BackgroundExecutorEventType,
} from './background-executor';
