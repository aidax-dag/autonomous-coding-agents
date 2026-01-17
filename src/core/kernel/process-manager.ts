/**
 * Process Manager
 *
 * Manages process lifecycle, state, and recovery for the Agent OS kernel.
 *
 * Features:
 * - Process lifecycle management (create, run, suspend, resume, terminate)
 * - State persistence and recovery
 * - Process coordination and communication
 * - Health monitoring and auto-recovery
 *
 * Feature: Agent OS Kernel
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Process states
 */
export enum ProcessState {
  CREATED = 'created',
  READY = 'ready',
  RUNNING = 'running',
  WAITING = 'waiting',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  FAILED = 'failed',
  ZOMBIE = 'zombie',
}

/**
 * Process type
 */
export enum ProcessType {
  AGENT = 'agent',
  TASK = 'task',
  WORKFLOW = 'workflow',
  SERVICE = 'service',
  DAEMON = 'daemon',
}

/**
 * Signal types for inter-process communication
 */
export enum Signal {
  SIGTERM = 'SIGTERM', // Graceful termination
  SIGKILL = 'SIGKILL', // Immediate termination
  SIGSTOP = 'SIGSTOP', // Suspend
  SIGCONT = 'SIGCONT', // Resume
  SIGUSR1 = 'SIGUSR1', // User-defined 1
  SIGUSR2 = 'SIGUSR2', // User-defined 2
  SIGCHLD = 'SIGCHLD', // Child state change
  SIGHUP = 'SIGHUP', // Reload configuration
}

/**
 * Process descriptor
 */
export interface ProcessDescriptor {
  pid: string;
  ppid?: string; // Parent process ID
  name: string;
  type: ProcessType;
  state: ProcessState;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  terminatedAt?: Date;
  exitCode?: number;
  exitReason?: string;
  resourceUsage: ProcessResourceUsage;
  metadata?: Record<string, unknown>;
}

/**
 * Process resource usage
 */
export interface ProcessResourceUsage {
  cpuTimeMs: number;
  memoryBytes: number;
  tokensUsed: number;
  toolCalls: number;
}

/**
 * Process context (for state persistence)
 */
export interface ProcessContext {
  pid: string;
  state: ProcessState;
  stack: ProcessStackFrame[];
  variables: Map<string, unknown>;
  checkpoints: ProcessCheckpoint[];
  lastCheckpointAt?: Date;
}

/**
 * Process stack frame
 */
export interface ProcessStackFrame {
  id: string;
  name: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Process checkpoint for recovery
 */
export interface ProcessCheckpoint {
  id: string;
  timestamp: Date;
  state: ProcessState;
  data: Record<string, unknown>;
  resourceUsage: ProcessResourceUsage;
}

/**
 * Process group
 */
export interface ProcessGroup {
  id: string;
  name: string;
  leader: string;
  members: Set<string>;
  createdAt: Date;
}

/**
 * Process message for IPC
 */
export interface ProcessMessage {
  id: string;
  fromPid: string;
  toPid: string;
  type: string;
  payload: unknown;
  timestamp: Date;
  replyTo?: string;
}

/**
 * Process manager configuration
 */
export interface ProcessManagerConfig {
  maxProcesses: number;
  maxProcessesPerType: Partial<Record<ProcessType, number>>;
  defaultPriority: number;
  checkpointIntervalMs: number;
  zombieTimeoutMs: number;
  healthCheckIntervalMs: number;
  maxRestartAttempts: number;
  restartDelayMs: number;
  enableAutoRecovery: boolean;
  enableHealthCheck: boolean;
}

/**
 * Process manager events
 */
export interface ProcessManagerEvents {
  'process:created': ProcessDescriptor;
  'process:started': ProcessDescriptor;
  'process:terminated': ProcessDescriptor;
  'process:failed': { process: ProcessDescriptor; error: Error };
  'process:suspended': ProcessDescriptor;
  'process:resumed': ProcessDescriptor;
  'process:state_changed': { process: ProcessDescriptor; previousState: ProcessState };
  'process:signal': { pid: string; signal: Signal };
  'process:message': ProcessMessage;
  'process:checkpoint': { pid: string; checkpoint: ProcessCheckpoint };
  'process:recovered': { pid: string; fromCheckpoint: ProcessCheckpoint };
  'group:created': ProcessGroup;
  'group:member_added': { groupId: string; pid: string };
  'group:member_removed': { groupId: string; pid: string };
  'health:check': { healthy: number; unhealthy: number };
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const ProcessManagerConfigSchema = z.object({
  maxProcesses: z.number().min(1).default(1000),
  maxProcessesPerType: z.record(z.number()).optional().default({}),
  defaultPriority: z.number().min(0).max(100).default(50),
  checkpointIntervalMs: z.number().min(1000).default(30000),
  zombieTimeoutMs: z.number().min(1000).default(60000),
  healthCheckIntervalMs: z.number().min(1000).default(10000),
  maxRestartAttempts: z.number().min(0).default(3),
  restartDelayMs: z.number().min(100).default(1000),
  enableAutoRecovery: z.boolean().default(true),
  enableHealthCheck: z.boolean().default(true),
});

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PROCESS_MANAGER_CONFIG: ProcessManagerConfig = {
  maxProcesses: 1000,
  maxProcessesPerType: {
    [ProcessType.AGENT]: 100,
    [ProcessType.TASK]: 500,
    [ProcessType.WORKFLOW]: 50,
    [ProcessType.SERVICE]: 20,
    [ProcessType.DAEMON]: 10,
  },
  defaultPriority: 50,
  checkpointIntervalMs: 30000,
  zombieTimeoutMs: 60000,
  healthCheckIntervalMs: 10000,
  maxRestartAttempts: 3,
  restartDelayMs: 1000,
  enableAutoRecovery: true,
  enableHealthCheck: true,
};

// ============================================================================
// Process Manager Implementation
// ============================================================================

/**
 * Process Manager
 *
 * Manages process lifecycle, state, and recovery for the Agent OS.
 */
export class ProcessManager extends EventEmitter {
  private config: ProcessManagerConfig;
  private processes: Map<string, ProcessDescriptor>;
  private contexts: Map<string, ProcessContext>;
  private groups: Map<string, ProcessGroup>;
  private messageQueues: Map<string, ProcessMessage[]>;
  private signalHandlers: Map<string, Map<Signal, (signal: Signal) => void>>;
  private restartCounts: Map<string, number>;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private checkpointTimer?: ReturnType<typeof setInterval>;
  private pidCounter: number;

  constructor(config: Partial<ProcessManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESS_MANAGER_CONFIG, ...config };
    this.processes = new Map();
    this.contexts = new Map();
    this.groups = new Map();
    this.messageQueues = new Map();
    this.signalHandlers = new Map();
    this.restartCounts = new Map();
    this.pidCounter = 1;

    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }

    if (this.config.enableAutoRecovery) {
      this.startCheckpointing();
    }
  }

  // ==========================================================================
  // Process Lifecycle
  // ==========================================================================

  /**
   * Create a new process
   */
  create(
    name: string,
    type: ProcessType,
    options?: {
      ppid?: string;
      priority?: number;
      metadata?: Record<string, unknown>;
    }
  ): ProcessDescriptor | null {
    // Check limits
    if (this.processes.size >= this.config.maxProcesses) {
      return null;
    }

    const typeLimit = this.config.maxProcessesPerType[type];
    if (typeLimit !== undefined) {
      const typeCount = Array.from(this.processes.values()).filter(
        (p) => p.type === type && p.state !== ProcessState.TERMINATED
      ).length;
      if (typeCount >= typeLimit) {
        return null;
      }
    }

    const pid = this.generatePid();
    const process: ProcessDescriptor = {
      pid,
      ppid: options?.ppid,
      name,
      type,
      state: ProcessState.CREATED,
      priority: options?.priority ?? this.config.defaultPriority,
      createdAt: new Date(),
      resourceUsage: {
        cpuTimeMs: 0,
        memoryBytes: 0,
        tokensUsed: 0,
        toolCalls: 0,
      },
      metadata: options?.metadata,
    };

    this.processes.set(pid, process);

    // Initialize context
    this.contexts.set(pid, {
      pid,
      state: ProcessState.CREATED,
      stack: [],
      variables: new Map(),
      checkpoints: [],
    });

    // Initialize message queue
    this.messageQueues.set(pid, []);

    // Initialize signal handlers
    this.signalHandlers.set(pid, new Map());

    this.emit('process:created', process);
    return process;
  }

  /**
   * Start a process
   */
  start(pid: string): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (process.state !== ProcessState.CREATED && process.state !== ProcessState.READY) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.RUNNING;
    process.startedAt = new Date();

    this.emit('process:state_changed', { process, previousState });
    this.emit('process:started', process);
    return true;
  }

  /**
   * Suspend a process
   */
  suspend(pid: string): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (process.state !== ProcessState.RUNNING && process.state !== ProcessState.WAITING) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.SUSPENDED;

    // Create checkpoint before suspending
    this.createCheckpoint(pid);

    this.emit('process:state_changed', { process, previousState });
    this.emit('process:suspended', process);
    return true;
  }

  /**
   * Resume a suspended process
   */
  resume(pid: string): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (process.state !== ProcessState.SUSPENDED) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.RUNNING;

    this.emit('process:state_changed', { process, previousState });
    this.emit('process:resumed', process);
    return true;
  }

  /**
   * Terminate a process
   */
  terminate(pid: string, exitCode: number = 0, reason?: string): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (process.state === ProcessState.TERMINATED) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.TERMINATED;
    process.terminatedAt = new Date();
    process.exitCode = exitCode;
    process.exitReason = reason;

    // Notify parent if exists
    if (process.ppid) {
      this.sendSignal(process.ppid, Signal.SIGCHLD);
    }

    // Clean up
    this.messageQueues.delete(pid);
    this.signalHandlers.delete(pid);

    this.emit('process:state_changed', { process, previousState });
    this.emit('process:terminated', process);
    return true;
  }

  /**
   * Mark process as failed
   */
  fail(pid: string, error: Error): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.FAILED;
    process.terminatedAt = new Date();
    process.exitCode = 1;
    process.exitReason = error.message;

    // Attempt auto-recovery
    if (this.config.enableAutoRecovery) {
      this.attemptRecovery(pid);
    }

    this.emit('process:state_changed', { process, previousState });
    this.emit('process:failed', { process, error });
    return true;
  }

  /**
   * Set process to waiting state
   */
  wait(pid: string): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (process.state !== ProcessState.RUNNING) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.WAITING;

    this.emit('process:state_changed', { process, previousState });
    return true;
  }

  /**
   * Wake up waiting process
   */
  wakeup(pid: string): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (process.state !== ProcessState.WAITING) {
      return false;
    }

    const previousState = process.state;
    process.state = ProcessState.RUNNING;

    this.emit('process:state_changed', { process, previousState });
    return true;
  }

  // ==========================================================================
  // Process Information
  // ==========================================================================

  /**
   * Get process descriptor
   */
  getProcess(pid: string): ProcessDescriptor | undefined {
    return this.processes.get(pid);
  }

  /**
   * Get all processes
   */
  getAllProcesses(): ProcessDescriptor[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by type
   */
  getProcessesByType(type: ProcessType): ProcessDescriptor[] {
    return Array.from(this.processes.values()).filter((p) => p.type === type);
  }

  /**
   * Get processes by state
   */
  getProcessesByState(state: ProcessState): ProcessDescriptor[] {
    return Array.from(this.processes.values()).filter((p) => p.state === state);
  }

  /**
   * Get child processes
   */
  getChildren(ppid: string): ProcessDescriptor[] {
    return Array.from(this.processes.values()).filter((p) => p.ppid === ppid);
  }

  /**
   * Get process tree
   */
  getProcessTree(pid: string): ProcessDescriptor[] {
    const tree: ProcessDescriptor[] = [];
    const process = this.processes.get(pid);

    if (!process) {
      return tree;
    }

    tree.push(process);
    const children = this.getChildren(pid);

    for (const child of children) {
      tree.push(...this.getProcessTree(child.pid));
    }

    return tree;
  }

  // ==========================================================================
  // Process Context & State
  // ==========================================================================

  /**
   * Get process context
   */
  getContext(pid: string): ProcessContext | undefined {
    return this.contexts.get(pid);
  }

  /**
   * Set context variable
   */
  setVariable(pid: string, key: string, value: unknown): boolean {
    const context = this.contexts.get(pid);
    if (!context) {
      return false;
    }

    context.variables.set(key, value);
    return true;
  }

  /**
   * Get context variable
   */
  getVariable(pid: string, key: string): unknown {
    const context = this.contexts.get(pid);
    return context?.variables.get(key);
  }

  /**
   * Push stack frame
   */
  pushFrame(pid: string, name: string, data: Record<string, unknown>): boolean {
    const context = this.contexts.get(pid);
    if (!context) {
      return false;
    }

    context.stack.push({
      id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      data,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Pop stack frame
   */
  popFrame(pid: string): ProcessStackFrame | undefined {
    const context = this.contexts.get(pid);
    if (!context) {
      return undefined;
    }

    return context.stack.pop();
  }

  /**
   * Update resource usage
   */
  updateResourceUsage(
    pid: string,
    usage: Partial<ProcessResourceUsage>
  ): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    if (usage.cpuTimeMs !== undefined) {
      process.resourceUsage.cpuTimeMs += usage.cpuTimeMs;
    }
    if (usage.memoryBytes !== undefined) {
      process.resourceUsage.memoryBytes = usage.memoryBytes;
    }
    if (usage.tokensUsed !== undefined) {
      process.resourceUsage.tokensUsed += usage.tokensUsed;
    }
    if (usage.toolCalls !== undefined) {
      process.resourceUsage.toolCalls += usage.toolCalls;
    }

    return true;
  }

  // ==========================================================================
  // Checkpointing & Recovery
  // ==========================================================================

  /**
   * Create a checkpoint
   */
  createCheckpoint(pid: string): ProcessCheckpoint | undefined {
    const process = this.processes.get(pid);
    const context = this.contexts.get(pid);

    if (!process || !context) {
      return undefined;
    }

    const checkpoint: ProcessCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
      state: process.state,
      data: {
        stack: [...context.stack],
        variables: Object.fromEntries(context.variables),
      },
      resourceUsage: { ...process.resourceUsage },
    };

    context.checkpoints.push(checkpoint);
    context.lastCheckpointAt = checkpoint.timestamp;

    // Keep only last 10 checkpoints
    if (context.checkpoints.length > 10) {
      context.checkpoints = context.checkpoints.slice(-10);
    }

    this.emit('process:checkpoint', { pid, checkpoint });
    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(pid: string, checkpointId?: string): boolean {
    const process = this.processes.get(pid);
    const context = this.contexts.get(pid);

    if (!process || !context) {
      return false;
    }

    const checkpoint = checkpointId
      ? context.checkpoints.find((cp) => cp.id === checkpointId)
      : context.checkpoints[context.checkpoints.length - 1];

    if (!checkpoint) {
      return false;
    }

    // Restore state
    process.state = checkpoint.state;
    process.resourceUsage = { ...checkpoint.resourceUsage };

    // Restore context
    context.state = checkpoint.state;
    context.stack = [...(checkpoint.data.stack as ProcessStackFrame[])];
    context.variables = new Map(
      Object.entries(checkpoint.data.variables as Record<string, unknown>)
    );

    this.emit('process:recovered', { pid, fromCheckpoint: checkpoint });
    return true;
  }

  /**
   * Attempt auto-recovery
   */
  private attemptRecovery(pid: string): void {
    const restartCount = this.restartCounts.get(pid) ?? 0;

    if (restartCount >= this.config.maxRestartAttempts) {
      return;
    }

    this.restartCounts.set(pid, restartCount + 1);

    setTimeout(() => {
      if (this.restoreFromCheckpoint(pid)) {
        this.start(pid);
      }
    }, this.config.restartDelayMs * (restartCount + 1));
  }

  /**
   * Start periodic checkpointing
   */
  private startCheckpointing(): void {
    this.checkpointTimer = setInterval(() => {
      for (const [pid, process] of this.processes) {
        if (
          process.state === ProcessState.RUNNING ||
          process.state === ProcessState.WAITING
        ) {
          this.createCheckpoint(pid);
        }
      }
    }, this.config.checkpointIntervalMs);
  }

  // ==========================================================================
  // Inter-Process Communication
  // ==========================================================================

  /**
   * Send a signal to a process
   */
  sendSignal(pid: string, signal: Signal): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    // Handle built-in signals
    switch (signal) {
      case Signal.SIGTERM:
        this.terminate(pid, 0, 'SIGTERM');
        break;
      case Signal.SIGKILL:
        this.terminate(pid, 137, 'SIGKILL');
        break;
      case Signal.SIGSTOP:
        this.suspend(pid);
        break;
      case Signal.SIGCONT:
        this.resume(pid);
        break;
    }

    // Call custom handler if registered
    const handlers = this.signalHandlers.get(pid);
    const handler = handlers?.get(signal);
    if (handler) {
      handler(signal);
    }

    this.emit('process:signal', { pid, signal });
    return true;
  }

  /**
   * Register signal handler
   */
  onSignal(pid: string, signal: Signal, handler: (signal: Signal) => void): boolean {
    const handlers = this.signalHandlers.get(pid);
    if (!handlers) {
      return false;
    }

    handlers.set(signal, handler);
    return true;
  }

  /**
   * Send message to a process
   */
  sendMessage(fromPid: string, toPid: string, type: string, payload: unknown): string | null {
    const fromProcess = this.processes.get(fromPid);
    const toProcess = this.processes.get(toPid);
    const queue = this.messageQueues.get(toPid);

    if (!fromProcess || !toProcess || !queue) {
      return null;
    }

    const message: ProcessMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      fromPid,
      toPid,
      type,
      payload,
      timestamp: new Date(),
    };

    queue.push(message);
    this.emit('process:message', message);

    // Wake up waiting process
    if (toProcess.state === ProcessState.WAITING) {
      this.wakeup(toPid);
    }

    return message.id;
  }

  /**
   * Receive message (non-blocking)
   */
  receiveMessage(pid: string): ProcessMessage | undefined {
    const queue = this.messageQueues.get(pid);
    if (!queue || queue.length === 0) {
      return undefined;
    }

    return queue.shift();
  }

  /**
   * Get pending messages count
   */
  getPendingMessagesCount(pid: string): number {
    return this.messageQueues.get(pid)?.length ?? 0;
  }

  // ==========================================================================
  // Process Groups
  // ==========================================================================

  /**
   * Create a process group
   */
  createGroup(name: string, leaderPid: string): ProcessGroup | null {
    const leader = this.processes.get(leaderPid);
    if (!leader) {
      return null;
    }

    const id = `pg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const group: ProcessGroup = {
      id,
      name,
      leader: leaderPid,
      members: new Set([leaderPid]),
      createdAt: new Date(),
    };

    this.groups.set(id, group);
    this.emit('group:created', group);
    return group;
  }

  /**
   * Add process to group
   */
  addToGroup(groupId: string, pid: string): boolean {
    const group = this.groups.get(groupId);
    const process = this.processes.get(pid);

    if (!group || !process) {
      return false;
    }

    group.members.add(pid);
    this.emit('group:member_added', { groupId, pid });
    return true;
  }

  /**
   * Remove process from group
   */
  removeFromGroup(groupId: string, pid: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    group.members.delete(pid);
    this.emit('group:member_removed', { groupId, pid });
    return true;
  }

  /**
   * Send signal to entire group
   */
  sendGroupSignal(groupId: string, signal: Signal): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    for (const pid of group.members) {
      this.sendSignal(pid, signal);
    }

    return true;
  }

  /**
   * Get group
   */
  getGroup(groupId: string): ProcessGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Get all groups
   */
  getAllGroups(): ProcessGroup[] {
    return Array.from(this.groups.values());
  }

  // ==========================================================================
  // Health Monitoring
  // ==========================================================================

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    let healthy = 0;
    let unhealthy = 0;
    const now = new Date();

    for (const [_pid, process] of this.processes) {
      // Check for zombie processes
      if (process.state === ProcessState.TERMINATED) {
        const terminatedTime = process.terminatedAt?.getTime() ?? 0;
        if (now.getTime() - terminatedTime > this.config.zombieTimeoutMs) {
          process.state = ProcessState.ZOMBIE;
        }
        continue;
      }

      // Check process health
      if (
        process.state === ProcessState.RUNNING ||
        process.state === ProcessState.WAITING ||
        process.state === ProcessState.READY
      ) {
        healthy++;
      } else if (process.state === ProcessState.FAILED) {
        unhealthy++;
      }
    }

    this.emit('health:check', { healthy, unhealthy });
  }

  /**
   * Clean up zombie processes
   */
  cleanupZombies(): number {
    let cleaned = 0;

    for (const [pid, process] of this.processes) {
      if (process.state === ProcessState.ZOMBIE) {
        this.processes.delete(pid);
        this.contexts.delete(pid);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate unique PID
   */
  private generatePid(): string {
    return `pid_${this.pidCounter++}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get process manager statistics
   */
  getStats(): {
    total: number;
    byState: Record<ProcessState, number>;
    byType: Record<ProcessType, number>;
    groups: number;
    averageResourceUsage: ProcessResourceUsage;
  } {
    const byState: Record<ProcessState, number> = {
      [ProcessState.CREATED]: 0,
      [ProcessState.READY]: 0,
      [ProcessState.RUNNING]: 0,
      [ProcessState.WAITING]: 0,
      [ProcessState.SUSPENDED]: 0,
      [ProcessState.TERMINATED]: 0,
      [ProcessState.FAILED]: 0,
      [ProcessState.ZOMBIE]: 0,
    };

    const byType: Record<ProcessType, number> = {
      [ProcessType.AGENT]: 0,
      [ProcessType.TASK]: 0,
      [ProcessType.WORKFLOW]: 0,
      [ProcessType.SERVICE]: 0,
      [ProcessType.DAEMON]: 0,
    };

    let totalCpu = 0;
    let totalMemory = 0;
    let totalTokens = 0;
    let totalCalls = 0;

    for (const process of this.processes.values()) {
      byState[process.state]++;
      byType[process.type]++;
      totalCpu += process.resourceUsage.cpuTimeMs;
      totalMemory += process.resourceUsage.memoryBytes;
      totalTokens += process.resourceUsage.tokensUsed;
      totalCalls += process.resourceUsage.toolCalls;
    }

    const count = this.processes.size || 1;

    return {
      total: this.processes.size,
      byState,
      byType,
      groups: this.groups.size,
      averageResourceUsage: {
        cpuTimeMs: totalCpu / count,
        memoryBytes: totalMemory / count,
        tokensUsed: totalTokens / count,
        toolCalls: totalCalls / count,
      },
    };
  }

  /**
   * Shutdown process manager
   */
  shutdown(): void {
    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    // Terminate all processes
    for (const [pid, process] of this.processes) {
      if (process.state !== ProcessState.TERMINATED) {
        this.terminate(pid, 0, 'Shutdown');
      }
    }
  }

  /**
   * Reset process manager
   */
  reset(): void {
    this.shutdown();
    this.processes.clear();
    this.contexts.clear();
    this.groups.clear();
    this.messageQueues.clear();
    this.signalHandlers.clear();
    this.restartCounts.clear();
    this.pidCounter = 1;

    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }
    if (this.config.enableAutoRecovery) {
      this.startCheckpointing();
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a process manager instance
 */
export function createProcessManager(
  config: Partial<ProcessManagerConfig> = {}
): ProcessManager {
  return new ProcessManager(config);
}
