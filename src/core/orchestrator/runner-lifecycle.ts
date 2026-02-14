/**
 * Runner Lifecycle
 *
 * Extracted from orchestrator-runner.ts to isolate session management,
 * context monitoring wiring, and hook-based lifecycle events.
 *
 * @module core/orchestrator/runner-lifecycle
 */

import { EventEmitter } from 'events';
import { HookRegistry } from '../hooks/hook-registry';
import { HookExecutor } from '../hooks/hook-executor';
import { HookEvent } from '../interfaces/hook.interface';
import { ServiceRegistry } from '../services/service-registry';
import type { ContextManager } from '../context/context-manager';
import type { ContextEventHandler } from '../context/interfaces/context.interface';
import { logger } from '@/shared/logging/logger';

/**
 * Dependencies injected into RunnerLifecycle by OrchestratorRunner
 */
export interface RunnerLifecycleDeps {
  hookRegistry: HookRegistry;
  hookExecutor: HookExecutor;
  emitter: EventEmitter;
  config: {
    enableSession: boolean;
    enableContextManagement: boolean;
  };
}

/**
 * RunnerLifecycle
 *
 * Manages session start/end, context monitoring wiring, and
 * context compaction triggers.
 */
export class RunnerLifecycle {
  private readonly deps: RunnerLifecycleDeps;
  private currentSessionId: string | null = null;
  private contextEventHandlers: Array<{ event: string; handler: ContextEventHandler }> = [];

  constructor(deps: RunnerLifecycleDeps) {
    this.deps = deps;
  }

  /**
   * Get the current session ID (null if no session is active).
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Start a session if the session module is enabled.
   */
  async startSession(): Promise<void> {
    if (!this.deps.config.enableSession) return;

    try {
      const registry = ServiceRegistry.getInstance();
      const sessionManager = registry.getSessionManager();
      if (sessionManager) {
        const sessionId = await sessionManager.startSession();
        this.currentSessionId = sessionId;
        logger.info('Session started', { sessionId });
      }
    } catch (err) {
      logger.debug('Session start failed', { error: (err as Error).message });
    }
  }

  /**
   * End the current session if one is active.
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const registry = ServiceRegistry.getInstance();
      const sessionManager = registry.getSessionManager();
      if (sessionManager) {
        await sessionManager.endSession(this.currentSessionId);
        logger.info('Session ended', { sessionId: this.currentSessionId });
      }
    } catch (err) {
      logger.debug('Session end failed', { error: (err as Error).message });
    }
    this.currentSessionId = null;
  }

  /**
   * Wire context monitoring events from ContextManager to runner events.
   * Subscribes to usage-warning and usage-critical events and stores
   * handlers for cleanup during stop/destroy.
   */
  wireContextMonitoring(): void {
    if (!this.deps.config.enableContextManagement) return;

    try {
      const registry = ServiceRegistry.getInstance();
      const contextManager = registry.getContextManager();
      if (!contextManager) return;

      const warningHandler: ContextEventHandler = () => {
        logger.warn('Context usage warning - approaching limit');
        this.deps.emitter.emit('context:warning');
      };

      const criticalHandler: ContextEventHandler = () => {
        logger.warn('Context usage critical - triggering compaction');
        this.deps.emitter.emit('context:critical');
        this.triggerContextCompaction();
      };

      contextManager.on('usage-warning', warningHandler);
      contextManager.on('usage-critical', criticalHandler);

      this.contextEventHandlers.push(
        { event: 'usage-warning', handler: warningHandler },
        { event: 'usage-critical', handler: criticalHandler },
      );

      logger.info('Context monitoring wired to orchestrator runner');
    } catch (err) {
      logger.debug('Failed to wire context monitoring', { error: (err as Error).message });
    }
  }

  /**
   * Trigger context compaction via CONTEXT_COMPACT hook event.
   */
  async triggerContextCompaction(): Promise<void> {
    try {
      const registry = ServiceRegistry.getInstance();
      const contextManager = registry.getContextManager();
      if (!contextManager) return;

      if (this.deps.hookRegistry.count() > 0) {
        await this.deps.hookExecutor.executeHooks(HookEvent.CONTEXT_COMPACT, {
          usage: contextManager.getUsageStats(),
        });
      }

      logger.info('Context compaction triggered');
    } catch (err) {
      logger.debug('Context compaction failed', { error: (err as Error).message });
    }
  }

  /**
   * Remove context event listeners from the ContextManager.
   */
  cleanupContextListeners(): void {
    try {
      const registry = ServiceRegistry.getInstance();
      const contextManager = registry.getContextManager();
      if (!contextManager) return;

      for (const { event, handler } of this.contextEventHandlers) {
        contextManager.off(event as Parameters<ContextManager['off']>[0], handler);
      }
      this.contextEventHandlers = [];
    } catch {
      /* cleanup error ignored */
    }
  }

  /**
   * Fire AGENT_STARTED hook.
   */
  async fireAgentStartedHook(agentCount: number): Promise<void> {
    if (this.deps.hookRegistry.count() > 0) {
      await this.deps.hookExecutor.executeHooks(
        HookEvent.AGENT_STARTED,
        { agentCount },
      ).catch((e: unknown) => {
        logger.warn('AGENT_STARTED hook failed', { error: e instanceof Error ? e.message : String(e) });
      });
    }
  }

  /**
   * Fire AGENT_STOPPED hook.
   */
  async fireAgentStoppedHook(data: Record<string, unknown> = {}): Promise<void> {
    if (this.deps.hookRegistry.count() > 0) {
      await this.deps.hookExecutor.executeHooks(
        HookEvent.AGENT_STOPPED,
        data,
      ).catch((e: unknown) => {
        logger.warn('AGENT_STOPPED hook failed', { error: e instanceof Error ? e.message : String(e) });
      });
    }
  }
}
