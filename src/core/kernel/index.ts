/**
 * Agent OS Kernel Module
 *
 * Provides core kernel services for the Agent OS including:
 * - Task scheduling with multiple algorithms
 * - Resource management and quota tracking
 * - Security with capability-based access control
 * - Process lifecycle management
 *
 * @module core/kernel
 *
 * @example
 * ```typescript
 * import {
 *   Scheduler,
 *   ResourceManager,
 *   SecurityModule,
 *   ProcessManager,
 *   createKernel,
 * } from '@core/kernel';
 *
 * // Create kernel components
 * const scheduler = new Scheduler({ algorithm: SchedulingAlgorithm.PRIORITY });
 * const resourceManager = new ResourceManager();
 * const security = new SecurityModule();
 * const processManager = new ProcessManager();
 *
 * // Or use factory function
 * const kernel = createKernel();
 * ```
 */

// ============================================================================
// Scheduler
// ============================================================================

export {
  // Core class
  Scheduler,
  createScheduler,

  // Enums
  TaskPriority,
  TaskState,
  SchedulingAlgorithm,

  // Defaults
  DEFAULT_SCHEDULER_CONFIG,

  // Types
  type SchedulableTask,
  type SchedulerConfig,
  type SchedulerStats,
  type SchedulerEvents,
} from './scheduler';

// ============================================================================
// Resource Manager
// ============================================================================

export {
  // Core class
  ResourceManager,
  createResourceManager,

  // Enums
  ResourceType,
  AllocationStatus,

  // Schemas
  ResourceManagerConfigSchema,

  // Defaults
  DEFAULT_RESOURCE_MANAGER_CONFIG,

  // Types
  type ResourceQuota,
  type AllocationRequest,
  type AllocationResult,
  type ResourceUsage,
  type ResourcePool,
  type ResourceManagerConfig,
  type ResourceManagerEvents,
} from './resource-manager';

// ============================================================================
// Security Module
// ============================================================================

export {
  // Core class
  SecurityModule,
  createSecurityModule,

  // Enums
  Permission,
  SecurityLevel,
  AuditEventType,

  // Schemas
  SecurityModuleConfigSchema,

  // Defaults
  DEFAULT_SECURITY_MODULE_CONFIG,
  DEFAULT_CAPABILITIES,

  // Types
  type Capability,
  type CapabilityConstraints,
  type SecurityPrincipal,
  type SandboxConfig,
  type SecurityPolicy,
  type SecurityRule,
  type SecurityCondition,
  type AuditLogEntry,
  type AccessRequest,
  type AccessDecision,
  type SecurityModuleConfig,
  type SecurityModuleEvents,
} from './security-module';

// ============================================================================
// Process Manager
// ============================================================================

export {
  // Core class
  ProcessManager,
  createProcessManager,

  // Enums
  ProcessState,
  ProcessType,
  Signal,

  // Schemas
  ProcessManagerConfigSchema,

  // Defaults
  DEFAULT_PROCESS_MANAGER_CONFIG,

  // Types
  type ProcessDescriptor,
  type ProcessResourceUsage,
  type ProcessContext,
  type ProcessStackFrame,
  type ProcessCheckpoint,
  type ProcessGroup,
  type ProcessMessage,
  type ProcessManagerConfig,
  type ProcessManagerEvents,
} from './process-manager';

// ============================================================================
// Kernel Factory
// ============================================================================

import { Scheduler, SchedulerConfig } from './scheduler';
import { ResourceManager, ResourceManagerConfig } from './resource-manager';
import { SecurityModule, SecurityModuleConfig } from './security-module';
import { ProcessManager, ProcessManagerConfig } from './process-manager';

/**
 * Kernel configuration
 */
export interface KernelConfig {
  scheduler?: Partial<SchedulerConfig>;
  resourceManager?: Partial<ResourceManagerConfig>;
  security?: Partial<SecurityModuleConfig>;
  processManager?: Partial<ProcessManagerConfig>;
}

/**
 * Kernel instance containing all components
 */
export interface Kernel {
  scheduler: Scheduler;
  resourceManager: ResourceManager;
  security: SecurityModule;
  processManager: ProcessManager;
  shutdown: () => void;
}

/**
 * Create a complete kernel instance
 */
export function createKernel(config: KernelConfig = {}): Kernel {
  const scheduler = new Scheduler(config.scheduler);
  const resourceManager = new ResourceManager(config.resourceManager);
  const security = new SecurityModule(config.security);
  const processManager = new ProcessManager(config.processManager);

  return {
    scheduler,
    resourceManager,
    security,
    processManager,
    shutdown: () => {
      processManager.shutdown();
    },
  };
}
