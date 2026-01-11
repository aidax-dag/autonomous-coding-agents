/**
 * Daemon Module
 *
 * Provides 24/7 continuous execution for autonomous project management.
 *
 * @module core/daemon
 */

export {
  // Enums
  DaemonStatus,
  DaemonEvent,

  // Interfaces
  type TaskExecutionResult,
  type IAgentDispatcher,
  type DispatcherStatus,
  type HealthMetrics,
  type DaemonError,
  type ProjectRegistration,
  type DaemonConfig,
  type IDaemon,

  // Schemas and Defaults
  DaemonConfigSchema,
  DEFAULT_DAEMON_CONFIG,

  // Classes
  MockAgentDispatcher,
  Daemon,

  // Factory
  createDaemon,
} from './daemon';
