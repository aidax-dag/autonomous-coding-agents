/**
 * Integration Setup
 *
 * Initializes optional integration modules (validation, learning, context)
 * and registers their hooks into the hook pipeline.
 *
 * Extracted from orchestrator-runner.ts to separate integration wiring
 * from core orchestration logic.
 *
 * @module core/orchestrator/integration-setup
 */

import { EventEmitter } from 'events';
import { HookRegistry } from '../hooks/hook-registry';
import { ServiceRegistry } from '../services/service-registry';
import { ConfidenceCheckHook } from '../hooks/confidence-check/confidence-check.hook';
import { SelfCheckHook } from '../hooks/self-check/self-check.hook';
import { ErrorLearningHook } from '../hooks/error-learning/error-learning.hook';
import { ContextOptimizerHook } from '../hooks/context-optimizer/context-optimizer.hook';
import type { ContextManager } from '../context/context-manager';
import type { WorkflowResult } from './orchestrator-runner';

/**
 * Integration feature flags
 */
export interface IntegrationFlags {
  enableValidation: boolean;
  enableLearning: boolean;
  enableContextManagement: boolean;
}

/**
 * Initialize integration modules and register hooks.
 *
 * Only initializes ServiceRegistry when at least one feature flag is enabled.
 * Returns cleanup info for disposal.
 */
export async function initializeIntegrations(
  flags: IntegrationFlags,
  hookRegistry: HookRegistry,
  workspaceDir: string,
  emitter: EventEmitter,
): Promise<void> {
  const needsRegistry =
    flags.enableValidation || flags.enableLearning || flags.enableContextManagement;

  if (!needsRegistry) return;

  const registry = ServiceRegistry.getInstance();
  if (!registry.isInitialized()) {
    await registry.initialize({
      projectRoot: workspaceDir,
      enableValidation: flags.enableValidation,
      enableLearning: flags.enableLearning,
      enableContext: flags.enableContextManagement,
    });
  }

  // Register validation hooks
  if (flags.enableValidation) {
    const checker = registry.getConfidenceChecker();
    if (checker) hookRegistry.register(new ConfidenceCheckHook(checker));

    const protocol = registry.getSelfCheckProtocol();
    if (protocol) hookRegistry.register(new SelfCheckHook(protocol));
  }

  // Register learning hooks
  if (flags.enableLearning) {
    const reflexion = registry.getReflexionPattern();
    const cache = registry.getSolutionsCache();
    if (reflexion) hookRegistry.register(new ErrorLearningHook(reflexion, cache));

    registerLearningListeners(registry, emitter);
  }

  // Register context hooks
  if (flags.enableContextManagement) {
    const ctxMgr = registry.getContextManager();
    if (ctxMgr) {
      hookRegistry.register(new ContextOptimizerHook(ctxMgr));
      registerContextListeners(ctxMgr, emitter);
    }
  }
}

/**
 * Register listeners for learning module feedback
 */
function registerLearningListeners(
  registry: ServiceRegistry,
  emitter: EventEmitter,
): void {
  const instinctStore = registry.getInstinctStore();
  if (!instinctStore) return;

  emitter.on('workflow:completed', async (result: WorkflowResult) => {
    try {
      const matching = await instinctStore.findMatching(
        `${result.teamType}:${result.taskId}`,
      );
      for (const instinct of matching) {
        if (result.success) {
          await instinctStore.reinforce(instinct.id);
        } else {
          await instinctStore.correct(instinct.id);
        }
      }
    } catch {
      /* learning error ignored */
    }
  });
}

/**
 * Register listeners for context management events
 */
function registerContextListeners(
  contextManager: ContextManager,
  emitter: EventEmitter,
): void {
  contextManager.on('usage-warning', (_data) => emitter.emit('context:warning'));
  contextManager.on('usage-critical', (_data) => emitter.emit('context:critical'));
}
