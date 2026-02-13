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
import { CodeQualityHook } from '../hooks/code-quality/code-quality.hook';
import { SandboxEscalationHook } from '../hooks/sandbox-escalation/sandbox-escalation.hook';
import { GoalVerificationHook } from '../hooks/goal-verification/goal-verification.hook';
import { PermissionGuardHook } from '../hooks/permission-guard/permission-guard.hook';
import { createPlatformSandbox } from '../security/platform-sandbox';
import type { IOSSandbox } from '../security/interfaces/os-sandbox.interface';
import { createTeamLearningHub } from '../learning/team-learning-hub';
import type { ContextManager } from '../context/context-manager';
import type { WorkflowResult } from './orchestrator-runner';
import type { SkillRegistry } from '../skills/skill-registry';
import {
  createPlanningSkill,
  createCodeReviewSkill,
  createTestGenerationSkill,
  createRefactoringSkill,
  createSecurityScanSkill,
  createGitWorkflowSkill,
  createDocumentationSkill,
  createDebuggingSkill,
  createPerformanceSkill,
  createMigrationSkill,
  createApiDesignSkill,
  createTddWorkflowSkill,
  createDatabaseSkill,
  createCicdSkill,
} from '../skills/skills';
import type { TeamAgentLLMAdapter } from './llm/team-agent-llm';
import {
  createPlanningSkillLLMExecutor,
  createCodeReviewSkillLLMExecutor,
  createTestGenerationSkillLLMExecutor,
  createRefactoringSkillLLMExecutor,
  createSecurityScanSkillLLMExecutor,
  createDebuggingSkillLLMExecutor,
  createDocumentationSkillLLMExecutor,
  createPerformanceSkillLLMExecutor,
} from './llm/skill-llm';

/**
 * Integration feature flags
 */
export interface IntegrationFlags {
  enableValidation: boolean;
  enableLearning: boolean;
  enableContextManagement: boolean;
  enableSecurity: boolean;
  enableSession: boolean;
  useRealQualityTools: boolean;
  enableMCP: boolean;
  enableLSP: boolean;
  enablePlugins: boolean;
  pluginsDir?: string;
  enablePlanningContext: boolean;
  /** LLM adapter for skill executors */
  llmAdapter?: TeamAgentLLMAdapter;
  /** Project context for skill prompts */
  projectContext?: string;
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
    flags.enableValidation || flags.enableLearning || flags.enableContextManagement ||
    flags.enableSecurity || flags.enableSession ||
    flags.enableMCP || flags.enableLSP || flags.enablePlugins || flags.enablePlanningContext;

  if (!needsRegistry && !flags.useRealQualityTools) return;

  const registry = ServiceRegistry.getInstance();
  if (!registry.isInitialized() && needsRegistry) {
    await registry.initialize({
      projectRoot: workspaceDir,
      enableValidation: flags.enableValidation,
      enableLearning: flags.enableLearning,
      enableContext: flags.enableContextManagement,
      enableSecurity: flags.enableSecurity,
      enableSession: flags.enableSession,
      enablePermission: flags.enableSecurity,
      enableMCP: flags.enableMCP,
      enableLSP: flags.enableLSP,
      enablePlugins: flags.enablePlugins,
      pluginsDir: flags.pluginsDir,
      enablePlanningContext: flags.enablePlanningContext,
    });
  }

  // Register validation hooks
  if (flags.enableValidation) {
    const checker = registry.getConfidenceChecker();
    if (checker) hookRegistry.register(new ConfidenceCheckHook(checker));

    const protocol = registry.getSelfCheckProtocol();
    if (protocol) hookRegistry.register(new SelfCheckHook(protocol));

    const verifier = registry.getGoalBackwardVerifier();
    if (verifier) hookRegistry.register(new GoalVerificationHook(verifier));
  }

  // Register permission guard hook
  if (flags.enableSecurity) {
    const permManager = registry.getPermissionManager();
    if (permManager) hookRegistry.register(new PermissionGuardHook(permManager));
  }

  // Register learning hooks + instinct sharing
  if (flags.enableLearning) {
    const reflexion = registry.getReflexionPattern();
    const cache = registry.getSolutionsCache();
    if (reflexion) hookRegistry.register(new ErrorLearningHook(reflexion, cache));

    registerLearningListeners(registry, emitter);

    // Initialize TeamLearningHub for cross-agent instinct sharing
    const instinctStore = registry.getInstinctStore();
    if (instinctStore) {
      const hub = createTeamLearningHub();
      emitter.emit('learning:hub-ready', hub);
    }
  }

  // Register context hooks
  if (flags.enableContextManagement) {
    const ctxMgr = registry.getContextManager();
    if (ctxMgr) {
      hookRegistry.register(new ContextOptimizerHook(ctxMgr));
      registerContextListeners(ctxMgr, emitter);
    }
  }

  // Register security hooks (needs both security and validation for ConfidenceChecker)
  if (flags.enableSecurity) {
    const sandbox = registry.getSandboxEscalation();
    const checker = registry.getConfidenceChecker();
    if (sandbox && checker) {
      hookRegistry.register(new SandboxEscalationHook(sandbox, checker));
    }
  }

  // Register code quality hook
  if (flags.useRealQualityTools) {
    hookRegistry.register(new CodeQualityHook());
  }

  // Auto-register skills when SkillRegistry is available
  if (needsRegistry) {
    const skillRegistry = registry.getSkillRegistry();
    if (skillRegistry) {
      registerDefaultSkills(skillRegistry, flags.llmAdapter, flags.projectContext);
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

/**
 * Create and return the platform-appropriate OS sandbox.
 * Returns SeatbeltSandbox on macOS, LandlockSandbox on Linux, null otherwise.
 * This is a convenience wrapper for callers that need direct sandbox access
 * outside of the hook pipeline.
 */
export function initializePlatformSandbox(): IOSSandbox | null {
  return createPlatformSandbox();
}

/**
 * Register all built-in skills into the SkillRegistry.
 * Includes 4 core skills + 10 expanded skills.
 * When an llmAdapter is provided, analysis/generation skills get LLM executors.
 */
function registerDefaultSkills(
  skillRegistry: SkillRegistry,
  llmAdapter?: TeamAgentLLMAdapter,
  projectContext?: string,
): void {
  const executorOpts = llmAdapter ? { adapter: llmAdapter, projectContext } : undefined;

  const skills = [
    // Core skills (LLM-backed when adapter provided)
    createPlanningSkill(executorOpts ? {
      executor: createPlanningSkillLLMExecutor(executorOpts),
    } : undefined),
    createCodeReviewSkill(executorOpts ? {
      executor: createCodeReviewSkillLLMExecutor(executorOpts),
    } : undefined),
    createTestGenerationSkill(executorOpts ? {
      executor: createTestGenerationSkillLLMExecutor(executorOpts),
    } : undefined),
    createRefactoringSkill(executorOpts ? {
      executor: createRefactoringSkillLLMExecutor(executorOpts),
    } : undefined),
    // Expanded skills — analysis/generation (LLM-backed)
    createSecurityScanSkill(executorOpts ? {
      executor: createSecurityScanSkillLLMExecutor(executorOpts),
    } : undefined),
    createDebuggingSkill(executorOpts ? {
      executor: createDebuggingSkillLLMExecutor(executorOpts),
    } : undefined),
    createDocumentationSkill(executorOpts ? {
      executor: createDocumentationSkillLLMExecutor(executorOpts),
    } : undefined),
    createPerformanceSkill(executorOpts ? {
      executor: createPerformanceSkillLLMExecutor(executorOpts),
    } : undefined),
    // Expanded skills — infrastructure/operational (no LLM executor)
    createGitWorkflowSkill(),
    createMigrationSkill(),
    createApiDesignSkill(),
    createTddWorkflowSkill(),
    createDatabaseSkill(),
    createCicdSkill(),
  ];

  for (const skill of skills) {
    try {
      skillRegistry.register(skill);
    } catch {
      /* skill already registered or init error — continue */
    }
  }
}
