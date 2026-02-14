/**
 * Collaboration Manager
 *
 * High-level orchestrator for multi-agent collaboration.
 * Manages agent registration, task delegation, conflict resolution,
 * and collaboration metrics.
 *
 * @module core/collaboration
 */

import { EventEmitter } from 'events';
import { FeedbackLoop } from './feedback-loop';
import type {
  AgentFeedback,
  FeedbackType,
  CollaborationConfig,
  CollaborationMetrics,
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Registered agent record
 */
export interface RegisteredAgent {
  id: string;
  name: string;
  capabilities: string[];
}

/**
 * Events emitted by CollaborationManager
 */
export interface CollaborationManagerEvents {
  'agent:registered': (agent: RegisteredAgent) => void;
  'agent:unregistered': (agentId: string) => void;
  'task:delegated': (fromAgent: string, toAgent: string, taskId: string) => void;
  'conflict:resolved': (sessionId: string, resolution: string) => void;
  'metrics:updated': (metrics: CollaborationMetrics) => void;
}

// ============================================================================
// Collaboration Manager
// ============================================================================

/**
 * Manages multi-agent collaboration lifecycle
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class CollaborationManager extends EventEmitter {
  private readonly feedbackLoop: FeedbackLoop;
  private readonly agents: Map<string, RegisteredAgent> = new Map();
  private readonly config: CollaborationConfig;
  private readonly metrics: CollaborationMetrics;
  private feedbackCounter = 0;
  private readonly sessionStartTimes: Map<string, number> = new Map();

  constructor(config: CollaborationConfig) {
    super();
    this.config = config;
    this.feedbackLoop = new FeedbackLoop(config);
    this.metrics = {
      totalFeedbacksSent: 0,
      totalFeedbacksReceived: 0,
      averageResolutionTime: 0,
      conflictsResolved: 0,
      delegationsCompleted: 0,
    };

    // Track resolution times for metrics
    this.feedbackLoop.on('session:created', (session) => {
      this.sessionStartTimes.set(session.id, Date.now());
    });

    this.feedbackLoop.on('session:resolved', (session) => {
      const startTime = this.sessionStartTimes.get(session.id);
      if (startTime) {
        const resolutionTime = Date.now() - startTime;
        this.updateAverageResolutionTime(resolutionTime);
        this.sessionStartTimes.delete(session.id);
      }
    });
  }

  // ── Agent Registry ───────────────────────────────────────

  /**
   * Register an agent for collaboration
   */
  registerAgent(id: string, name: string, capabilities: string[]): void {
    const agent: RegisteredAgent = { id, name, capabilities };
    this.agents.set(id, agent);
    this.emit('agent:registered', agent);
  }

  /**
   * Remove an agent from collaboration
   */
  unregisterAgent(id: string): void {
    if (this.agents.delete(id)) {
      this.emit('agent:unregistered', id);
    }
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  // ── Feedback Operations ──────────────────────────────────

  /**
   * Send a feedback request from one agent to another.
   * Creates an AgentFeedback and routes it through the feedback loop.
   */
  async requestFeedback(
    fromAgent: string,
    toAgent: string,
    taskId: string,
    type: FeedbackType,
    content: string,
  ): Promise<AgentFeedback> {
    if (!this.agents.has(fromAgent)) {
      throw new Error(`Agent not registered: ${fromAgent}`);
    }
    if (!this.agents.has(toAgent)) {
      throw new Error(`Agent not registered: ${toAgent}`);
    }

    const feedback: AgentFeedback = {
      id: `fb-${++this.feedbackCounter}-${Date.now()}`,
      fromAgent,
      toAgent,
      taskId,
      type,
      priority: type === 'conflict' ? 'high' : 'normal',
      content,
      timestamp: new Date().toISOString(),
      requiresResponse: type !== 'approval',
    };

    await this.feedbackLoop.sendFeedback(feedback);

    if (this.config.enableMetrics) {
      this.metrics.totalFeedbacksSent++;
      this.metrics.totalFeedbacksReceived++;
      this.emitMetricsUpdate();
    }

    return feedback;
  }

  // ── Task Delegation ──────────────────────────────────────

  /**
   * Delegate a task to the most suitable agent based on capability matching.
   * Returns the target agent ID, or null if no capable agent is found.
   */
  async delegateTask(
    fromAgent: string,
    taskId: string,
    requiredCapability: string,
  ): Promise<string | null> {
    // Find agents that have the required capability (excluding sender)
    const candidates = Array.from(this.agents.values()).filter(
      (agent) =>
        agent.id !== fromAgent &&
        agent.capabilities.includes(requiredCapability),
    );

    if (candidates.length === 0) {
      return null;
    }

    // Select the first matching agent (could be enhanced with load balancing)
    const target = candidates[0];

    if (this.config.enableMetrics) {
      this.metrics.delegationsCompleted++;
      this.emitMetricsUpdate();
    }

    this.emit('task:delegated', fromAgent, target.id, taskId);
    return target.id;
  }

  // ── Conflict Resolution ──────────────────────────────────

  /**
   * Resolve a conflict within a collaboration session
   */
  async resolveConflict(sessionId: string, resolution: string): Promise<void> {
    await this.feedbackLoop.resolveSession(sessionId);

    if (this.config.enableMetrics) {
      this.metrics.conflictsResolved++;
      this.emitMetricsUpdate();
    }

    this.emit('conflict:resolved', sessionId, resolution);
  }

  // ── Accessors ────────────────────────────────────────────

  /**
   * Get current collaboration metrics
   */
  getMetrics(): CollaborationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get the underlying feedback loop
   */
  getFeedbackLoop(): FeedbackLoop {
    return this.feedbackLoop;
  }

  // ── Lifecycle ────────────────────────────────────────────

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.agents.clear();
    this.feedbackLoop.removeAllListeners();
    this.sessionStartTimes.clear();
    this.removeAllListeners();
  }

  // ── Private Helpers ──────────────────────────────────────

  private updateAverageResolutionTime(newTime: number): void {
    const totalResolutions =
      this.metrics.conflictsResolved + 1; // +1 since this resolution hasn't been counted yet
    const currentTotal =
      this.metrics.averageResolutionTime * this.metrics.conflictsResolved;
    this.metrics.averageResolutionTime =
      (currentTotal + newTime) / totalResolutions;
  }

  private emitMetricsUpdate(): void {
    this.emit('metrics:updated', { ...this.metrics });
  }
}

// Type-safe event emitter augmentation
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CollaborationManager {
  on<E extends keyof CollaborationManagerEvents>(
    event: E,
    listener: CollaborationManagerEvents[E],
  ): this;
  emit<E extends keyof CollaborationManagerEvents>(
    event: E,
    ...args: Parameters<CollaborationManagerEvents[E]>
  ): boolean;
}
