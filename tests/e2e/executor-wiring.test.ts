/**
 * Executor Wiring E2E Tests
 *
 * Validates the complete executor pipeline:
 *   SchemaAwareMockLLM -> TeamAgentLLMAdapter.parseResponse -> Zod validation -> Agent result
 *
 * Unlike full-pipeline.test.ts (which tests ACP/TUI event propagation),
 * these tests verify that executor outputs are schema-valid and that
 * the correct prompts are sent to the LLM client.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { createOrchestratorRunner } from '@/core/orchestrator/orchestrator-runner';
import type { GoalResult } from '@/core/orchestrator/orchestrator-runner';
import { ServiceRegistry } from '@/core/services/service-registry';
import { createTeamAgentLLMAdapter } from '@/core/orchestrator/llm/team-agent-llm';
import {
  TestGenerationOutputSchema,
  DeepReviewOutputSchema,
  RefactoringOutputSchema,
} from '@/core/orchestrator/llm';
import {
  createPlanningLLMExecutor,
  validatePlanningOutput,
} from '@/core/orchestrator/llm/planning-llm';
import {
  createDevelopmentLLMExecutor,
  validateDevelopmentOutput,
} from '@/core/orchestrator/llm/development-llm';
import {
  createQALLMExecutor,
  validateQAOutput,
} from '@/core/orchestrator/llm/qa-llm';
import {
  createTestGenerationLLMExecutor,
  createDeepReviewLLMExecutor,
  createRefactoringLLMExecutor,
} from '@/core/orchestrator/llm/code-quality-llm';
import {
  createArchitectureLLMExecutor,
  createSecurityLLMExecutor,
  createDebuggingLLMExecutor,
  createDocumentationLLMExecutor,
  createExplorationAgentLLMExecutor,
  createIntegrationLLMExecutor,
  validateArchitectureOutput,
  validateSecurityOutput,
  validateDebuggingOutput,
  validateDocumentationOutput,
  validateExplorationOutput,
  validateIntegrationOutput,
} from '@/core/orchestrator/llm/expanded-agents-llm';
import {
  createExplorationLLMExecutor,
  createSelfPlanningLLMExecutor,
  validateExplorationResult,
  validateSelfPlanResult,
} from '@/core/orchestrator/llm/deep-worker-llm';
import { createTask, type TaskDocument, type TeamType, type TaskType } from '@/core/workspace/task-document';
import {
  createSchemaAwareMockLLM,
  type SchemaAwareMockLLM,
} from './helpers/schema-aware-mock-llm';

// ============================================================================
// Helpers
// ============================================================================

function createTestTask(overrides?: Partial<{
  title: string;
  type: TaskType;
  content: string;
  from: TeamType;
}>): TaskDocument {
  return createTask({
    title: overrides?.title || 'Test Task',
    type: overrides?.type || 'feature',
    from: overrides?.from || 'orchestrator',
    to: 'development',
    content: overrides?.content || 'Implement a utility function',
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('E2E: Executor Wiring', () => {
  let workspaceDir: string;
  let mockLLM: SchemaAwareMockLLM;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `e2e-executor-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
    mockLLM = createSchemaAwareMockLLM();
  });

  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    ServiceRegistry.resetInstance();
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Planning Agent E2E
  // ═══════════════════════════════════════════════════════════

  describe('Planning Agent Executor', () => {
    it('should produce valid PlanningOutput via LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({
        client: mockLLM,
        agentRole: 'planning',
      });

      const executor = createPlanningLLMExecutor({ adapter });
      const task = createTestTask({
        title: 'Create utility library',
        type: 'planning',
        content: 'Plan a utility library with string and array helpers',
      });

      const result = await executor(task);

      // Should be valid against schema
      expect(() => validatePlanningOutput(result)).not.toThrow();
      expect(result.title).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0].targetTeam).toBeDefined();

      // LLM should have been called with system prompt
      expect(mockLLM.calls).toHaveLength(1);
      expect(mockLLM.calls[0].messages[0].role).toBe('system');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Development Agent E2E
  // ═══════════════════════════════════════════════════════════

  describe('Development Agent Executor', () => {
    it('should produce valid DevelopmentOutput via LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({
        client: mockLLM,
        agentRole: 'development',
      });

      const executor = createDevelopmentLLMExecutor({ adapter });
      const task = createTestTask({
        title: 'Implement string helper',
        type: 'feature',
        content: 'Create a capitalize function',
      });

      const result = await executor(task);

      expect(() => validateDevelopmentOutput(result)).not.toThrow();
      expect(result.summary).toBeDefined();
      expect(result.filesModified.length).toBeGreaterThan(0);
      expect(['created', 'modified', 'deleted']).toContain(result.filesModified[0].action);

      expect(mockLLM.calls).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. QA Agent E2E
  // ═══════════════════════════════════════════════════════════

  describe('QA Agent Executor', () => {
    it('should produce valid QAOutput via LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({
        client: mockLLM,
        agentRole: 'qa',
      });

      const executor = createQALLMExecutor({ adapter });
      const task = createTestTask({
        title: 'Run QA checks',
        type: 'test',
        content: 'Verify feature implementation quality',
      });

      const result = await executor(task);

      expect(() => validateQAOutput(result)).not.toThrow();
      expect(result.summary).toBeDefined();
      expect(typeof result.approved).toBe('boolean');

      expect(mockLLM.calls).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Code Quality Executors E2E
  // ═══════════════════════════════════════════════════════════

  describe('Code Quality Executors', () => {
    it('TestGeneration executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createTestGenerationLLMExecutor({ adapter });
      const task = createTestTask({ type: 'test', content: 'Generate tests for feature module' });

      const result = await executor(task);

      expect(() => TestGenerationOutputSchema.parse(result)).not.toThrow();
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.totalGenerated).toBeGreaterThan(0);
      expect(result.estimatedCoverage).toBeDefined();
    });

    it('DeepReview executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createDeepReviewLLMExecutor({ adapter });
      const task = createTestTask({ type: 'review', content: 'Review code quality' });

      const result = await executor(task);

      expect(() => DeepReviewOutputSchema.parse(result)).not.toThrow();
      expect(result.findings).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(typeof result.approved).toBe('boolean');
    });

    it('Refactoring executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createRefactoringLLMExecutor({ adapter });
      const task = createTestTask({ content: 'Analyze refactoring opportunities' });

      const result = await executor(task);

      expect(() => RefactoringOutputSchema.parse(result)).not.toThrow();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.technicalDebtScore).toBeDefined();
      expect(result.codeHealth).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Expanded Agents E2E
  // ═══════════════════════════════════════════════════════════

  describe('Expanded Agent Executors', () => {
    it('Architecture executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createArchitectureLLMExecutor({ adapter });
      const task = createTestTask({ content: 'Analyze system architecture' });

      const result = await executor(task);

      expect(() => validateArchitectureOutput(result)).not.toThrow();
      expect(result.components.length).toBeGreaterThan(0);
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.recommendation).toBeDefined();
    });

    it('Security executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createSecurityLLMExecutor({ adapter });
      const task = createTestTask({ content: 'Perform security audit' });

      const result = await executor(task);

      expect(() => validateSecurityOutput(result)).not.toThrow();
      expect(result.summary).toBeDefined();
      expect(typeof result.riskScore).toBe('number');
      expect(['pass', 'fail', 'partial']).toContain(result.complianceStatus);
    });

    it('Debugging executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createDebuggingLLMExecutor({ adapter });
      const task = createTestTask({
        type: 'bugfix',
        content: 'Debug null reference error with root cause analysis',
      });

      const result = await executor(task);

      expect(() => validateDebuggingOutput(result)).not.toThrow();
      expect(result.rootCause).toBeDefined();
      expect(result.hypotheses.length).toBeGreaterThan(0);
      expect(result.suggestedFix).toBeDefined();
    });

    it('Documentation executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createDocumentationLLMExecutor({ adapter });
      const task = createTestTask({
        type: 'documentation',
        content: 'Generate project documentation',
      });

      const result = await executor(task);

      expect(() => validateDocumentationOutput(result)).not.toThrow();
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(['markdown', 'html', 'jsdoc']).toContain(result.format);
    });

    it('Exploration executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createExplorationAgentLLMExecutor({ adapter });
      const task = createTestTask({ content: 'Explore codebase structure for code exploration' });

      const result = await executor(task);

      expect(() => validateExplorationOutput(result)).not.toThrow();
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.symbols.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });

    it('Integration executor should return valid output', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createIntegrationLLMExecutor({ adapter });
      const task = createTestTask({ content: 'Verify component connections and cross-module integration' });

      const result = await executor(task);

      expect(() => validateIntegrationOutput(result)).not.toThrow();
      expect(result.connections.length).toBeGreaterThan(0);
      expect(typeof result.coverage).toBe('number');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.healthStatus);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. DeepWorker Executors E2E
  // ═══════════════════════════════════════════════════════════

  describe('DeepWorker Executors', () => {
    it('Exploration executor should return valid ExplorationResult', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createExplorationLLMExecutor({ adapter });

      const result = await executor({
        taskDescription: 'Explore workspace for feature implementation',
        workspaceDir,
      });

      expect(() => validateExplorationResult(result)).not.toThrow();
      expect(result.relevantFiles.length).toBeGreaterThan(0);
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });

    it('SelfPlanning executor should return valid SelfPlanResult', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createSelfPlanningLLMExecutor({ adapter });

      const explorationResult = {
        relevantFiles: ['src/feature.ts'],
        patterns: ['Factory Pattern'],
        dependencies: ['lodash'],
        summary: 'Found relevant files',
        duration: 100,
      };

      const result = await executor(
        {
          taskDescription: 'Create step-by-step execution plan',
          workspaceDir,
        },
        explorationResult,
      );

      expect(() => validateSelfPlanResult(result)).not.toThrow();
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(['small', 'medium', 'large']).toContain(result.totalEffort);
      expect(typeof result.duration).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. Error Handling
  // ═══════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should fail gracefully when LLM returns invalid JSON', async () => {
      const errorMockLLM = createSchemaAwareMockLLM({
        errorConfig: { errorOnNthCall: 1, errorType: 'parse' },
      });

      const adapter = createTeamAgentLLMAdapter({
        client: errorMockLLM,
        retryAttempts: 1,
      });

      const executor = createPlanningLLMExecutor({ adapter });
      const task = createTestTask({ type: 'planning', content: 'Plan something' });

      await expect(executor(task)).rejects.toThrow();
      expect(errorMockLLM.calls).toHaveLength(1);
    });

    it('should fail gracefully when LLM returns empty response', async () => {
      const errorMockLLM = createSchemaAwareMockLLM({
        errorConfig: { errorOnNthCall: 1, errorType: 'empty' },
      });

      const adapter = createTeamAgentLLMAdapter({
        client: errorMockLLM,
        retryAttempts: 1,
      });

      const executor = createPlanningLLMExecutor({ adapter });
      const task = createTestTask({ type: 'planning', content: 'Plan something' });

      await expect(executor(task)).rejects.toThrow();
    });

    it('should propagate timeout errors', async () => {
      const errorMockLLM = createSchemaAwareMockLLM({
        errorConfig: { errorOnNthCall: 1, errorType: 'timeout' },
      });

      const adapter = createTeamAgentLLMAdapter({
        client: errorMockLLM,
        retryAttempts: 1,
        retryDelay: 10,
      });

      const executor = createPlanningLLMExecutor({ adapter });
      const task = createTestTask({ type: 'planning', content: 'Plan something' });

      await expect(executor(task)).rejects.toThrow('timeout');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. Full Runner Pipeline E2E
  // ═══════════════════════════════════════════════════════════

  describe('Full Runner Pipeline', () => {
    it('should execute a goal through the full runner pipeline', async () => {
      const runner = createOrchestratorRunner({
        llmClient: mockLLM,
        workspaceDir,
        enableLLM: true,
      });

      await runner.start();

      const result: GoalResult = await runner.executeGoal(
        'E2E Executor Test Goal',
        'Implement and test a simple utility function',
        { priority: 'high', waitForCompletion: true },
      );

      await runner.destroy();

      // Goal should complete
      expect(result).toBeDefined();
      expect(result.goalId).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);

      // LLM should have been called at least once (for planning)
      expect(mockLLM.calls.length).toBeGreaterThan(0);

      // First call should be a planning call (system prompt)
      const firstSystemMsg = mockLLM.calls[0].messages.find((m) => m.role === 'system');
      expect(firstSystemMsg).toBeDefined();
    });

    it('should record all LLM calls during goal execution', async () => {
      const runner = createOrchestratorRunner({
        llmClient: mockLLM,
        workspaceDir,
        enableLLM: true,
      });

      await runner.start();

      await runner.executeGoal(
        'Call tracking test',
        'Plan and develop a feature',
        { waitForCompletion: true },
      );

      await runner.destroy();

      // Every call should have system + user messages
      for (const call of mockLLM.calls) {
        expect(call.messages.length).toBeGreaterThanOrEqual(2);
        expect(call.messages[0].role).toBe('system');
        expect(call.timestamp).toBeGreaterThan(0);
      }
    });
  });
});
