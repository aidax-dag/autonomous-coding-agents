/**
 * Skill Executor Wiring E2E Tests
 *
 * Validates the skill executor pipeline:
 *   SchemaAwareMockLLM -> TeamAgentLLMAdapter -> SkillLLMExecutor -> Skill.execute() -> SkillResult
 *
 * Tests both LLM-backed skills (8 analysis/generation) and
 * infrastructure skills (6 stubs that work without LLM).
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { SkillRegistry } from '@/core/skills/skill-registry';
import type { SkillContext } from '@/core/skills/interfaces/skill.interface';
import { createTeamAgentLLMAdapter } from '@/core/orchestrator/llm/team-agent-llm';
import {
  createPlanningSkillLLMExecutor,
  createCodeReviewSkillLLMExecutor,
  createTestGenerationSkillLLMExecutor,
  createRefactoringSkillLLMExecutor,
  createSecurityScanSkillLLMExecutor,
  createDebuggingSkillLLMExecutor,
  createDocumentationSkillLLMExecutor,
  createPerformanceSkillLLMExecutor,
} from '@/core/orchestrator/llm/skill-llm';
import {
  createPlanningSkill,
  createCodeReviewSkill,
  createTestGenerationSkill,
  createRefactoringSkill,
  createSecurityScanSkill,
  createDebuggingSkill,
  createDocumentationSkill,
  createPerformanceSkill,
  createGitWorkflowSkill,
  createMigrationSkill,
  createApiDesignSkill,
  createTddWorkflowSkill,
  createDatabaseSkill,
  createCicdSkill,
} from '@/core/skills/skills';
import {
  createSchemaAwareMockLLM,
  type SchemaAwareMockLLM,
} from './helpers/schema-aware-mock-llm';

// ============================================================================
// Helpers
// ============================================================================

function createTestContext(workspaceDir: string): SkillContext {
  return {
    workspaceDir,
    projectContext: 'E2E test project',
    timeout: 30000,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('E2E: Skill Executor Wiring', () => {
  let workspaceDir: string;
  let mockLLM: SchemaAwareMockLLM;
  let context: SkillContext;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `e2e-skill-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
    mockLLM = createSchemaAwareMockLLM();
    context = createTestContext(workspaceDir);
  });

  afterEach(() => {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Planning Skill with LLM Executor
  // ═══════════════════════════════════════════════════════════

  describe('Planning Skill', () => {
    it('should execute with LLM executor and return valid PlanningOutput', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createPlanningSkillLLMExecutor({ adapter });
      const skill = createPlanningSkill({ executor });

      const result = await skill.execute(
        { goal: 'Create a REST API for user management', maxTasks: 5 },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.title).toBeDefined();
      expect(result.output!.tasks.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // LLM was called
      expect(mockLLM.calls).toHaveLength(1);
      expect(mockLLM.calls[0].messages[0].role).toBe('system');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Code Review Skill with LLM Executor
  // ═══════════════════════════════════════════════════════════

  describe('Code Review Skill', () => {
    it('should execute with LLM executor and return valid DeepReviewOutput', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createCodeReviewSkillLLMExecutor({ adapter });
      const skill = createCodeReviewSkill({ executor });

      const result = await skill.execute(
        { files: ['src/feature.ts', 'src/utils.ts'], focus: ['security', 'performance'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.findings).toBeDefined();
      expect(result.output!.metrics).toBeDefined();
      expect(typeof result.output!.approved).toBe('boolean');
      expect(result.output!.actionItems).toBeDefined();

      expect(mockLLM.calls).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Test Generation Skill with LLM Executor
  // ═══════════════════════════════════════════════════════════

  describe('Test Generation Skill', () => {
    it('should execute with LLM executor and return valid TestGenerationOutput', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createTestGenerationSkillLLMExecutor({ adapter });
      const skill = createTestGenerationSkill({ executor });

      const result = await skill.execute(
        { sourceFiles: ['src/feature.ts'], testTypes: ['unit'], framework: 'jest' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.tests.length).toBeGreaterThan(0);
      expect(result.output!.totalGenerated).toBeGreaterThan(0);
      expect(result.output!.estimatedCoverage).toBeDefined();

      expect(mockLLM.calls).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Refactoring Skill with LLM Executor
  // ═══════════════════════════════════════════════════════════

  describe('Refactoring Skill', () => {
    it('should execute with LLM executor and return valid RefactoringOutput', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createRefactoringSkillLLMExecutor({ adapter });
      const skill = createRefactoringSkill({ executor });

      const result = await skill.execute(
        { files: ['src/feature.ts'], minPriority: 'medium' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.suggestions.length).toBeGreaterThan(0);
      expect(result.output!.technicalDebtScore).toBeDefined();
      expect(result.output!.codeHealth).toBeDefined();

      expect(mockLLM.calls).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Expanded LLM-backed Skills
  // ═══════════════════════════════════════════════════════════

  describe('Expanded LLM-backed Skills', () => {
    it('SecurityScan skill should execute with LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createSecurityScanSkillLLMExecutor({ adapter });
      const skill = createSecurityScanSkill({ executor });

      const result = await skill.execute(
        { files: ['src/api.ts'], checks: ['injection', 'xss'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.findings).toBeDefined();
      expect(result.output!.summary).toBeDefined();
      expect(typeof result.output!.score).toBe('number');

      expect(mockLLM.calls).toHaveLength(1);
    });

    it('Debugging skill should execute with LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createDebuggingSkillLLMExecutor({ adapter });
      const skill = createDebuggingSkill({ executor });

      const result = await skill.execute(
        {
          error: 'TypeError: Cannot read property "name" of undefined',
          stackTrace: 'at UserService.getUser (user-service.ts:42)',
          files: ['src/user-service.ts'],
        },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.rootCause).toBeDefined();
      expect(result.output!.hypothesis.length).toBeGreaterThan(0);
      expect(result.output!.suggestedFixes.length).toBeGreaterThan(0);
      expect(typeof result.output!.confidence).toBe('number');

      expect(mockLLM.calls).toHaveLength(1);
    });

    it('Documentation skill should execute with LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createDocumentationSkillLLMExecutor({ adapter });
      const skill = createDocumentationSkill({ executor });

      const result = await skill.execute(
        { files: ['src/feature.ts'], format: 'markdown', scope: 'module' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.documents.length).toBeGreaterThan(0);
      expect(result.output!.summary).toBeDefined();

      expect(mockLLM.calls).toHaveLength(1);
    });

    it('Performance skill should execute with LLM executor', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executor = createPerformanceSkillLLMExecutor({ adapter });
      const skill = createPerformanceSkill({ executor });

      const result = await skill.execute(
        { files: ['src/data.ts'], metrics: ['time', 'memory'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.findings.length).toBeGreaterThan(0);
      expect(typeof result.output!.overallScore).toBe('number');
      expect(result.output!.bottlenecks.length).toBeGreaterThan(0);

      expect(mockLLM.calls).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Infrastructure Skills (No LLM)
  // ═══════════════════════════════════════════════════════════

  describe('Infrastructure Skills (stub)', () => {
    it('GitWorkflow skill should execute without LLM', async () => {
      const skill = createGitWorkflowSkill();
      const result = await skill.execute(
        { operation: 'status' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // No LLM calls
      expect(mockLLM.calls).toHaveLength(0);
    });

    it('Migration skill should execute without LLM', async () => {
      const skill = createMigrationSkill();
      const result = await skill.execute(
        { from: 'v1', to: 'v2', files: ['src/model.ts'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('ApiDesign skill should execute without LLM', async () => {
      const skill = createApiDesignSkill();
      const result = await skill.execute(
        { name: 'Users API', type: 'rest' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('TddWorkflow skill should execute without LLM', async () => {
      const skill = createTddWorkflowSkill();
      const result = await skill.execute(
        { feature: 'Add user endpoint', files: ['src/user.ts'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('Database skill should execute without LLM', async () => {
      const skill = createDatabaseSkill();
      const result = await skill.execute(
        { operation: 'migration', schema: 'CREATE TABLE users (id INT)' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('CICD skill should execute without LLM', async () => {
      const skill = createCicdSkill();
      const result = await skill.execute(
        { platform: 'github-actions', project: 'my-app', stages: ['lint', 'test', 'build'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. Fallback (No Executor)
  // ═══════════════════════════════════════════════════════════

  describe('Fallback without LLM executor', () => {
    it('should return stub output when no executor is provided', async () => {
      // Create skill WITHOUT executor
      const skill = createPlanningSkill();

      const result = await skill.execute(
        { goal: 'Test fallback behavior' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // No LLM calls since no executor was injected
      expect(mockLLM.calls).toHaveLength(0);
    });

    it('code review skill should return stub without executor', async () => {
      const skill = createCodeReviewSkill();

      const result = await skill.execute(
        { files: ['src/feature.ts'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('test generation skill should return stub without executor', async () => {
      const skill = createTestGenerationSkill();

      const result = await skill.execute(
        { sourceFiles: ['src/feature.ts'] },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. SkillRegistry Integration
  // ═══════════════════════════════════════════════════════════

  describe('SkillRegistry Integration', () => {
    it('should register all 14 skills and execute LLM-backed ones', async () => {
      const adapter = createTeamAgentLLMAdapter({ client: mockLLM });
      const executorOpts = { adapter, projectContext: 'E2E test' };
      const registry = new SkillRegistry({ allowOverwrite: true });

      // Register all skills (same pattern as integration-setup.ts)
      const skills = [
        createPlanningSkill({ executor: createPlanningSkillLLMExecutor(executorOpts) }),
        createCodeReviewSkill({ executor: createCodeReviewSkillLLMExecutor(executorOpts) }),
        createTestGenerationSkill({ executor: createTestGenerationSkillLLMExecutor(executorOpts) }),
        createRefactoringSkill({ executor: createRefactoringSkillLLMExecutor(executorOpts) }),
        createSecurityScanSkill({ executor: createSecurityScanSkillLLMExecutor(executorOpts) }),
        createDebuggingSkill({ executor: createDebuggingSkillLLMExecutor(executorOpts) }),
        createDocumentationSkill({ executor: createDocumentationSkillLLMExecutor(executorOpts) }),
        createPerformanceSkill({ executor: createPerformanceSkillLLMExecutor(executorOpts) }),
        createGitWorkflowSkill(),
        createMigrationSkill(),
        createApiDesignSkill(),
        createTddWorkflowSkill(),
        createDatabaseSkill(),
        createCicdSkill(),
      ];

      for (const skill of skills) {
        registry.register(skill);
      }

      // Should have all 14 skills
      expect(registry.count()).toBe(14);

      // Execute a registered LLM-backed skill
      const planningSkill = registry.get('planning');
      expect(planningSkill).toBeDefined();

      const result = await planningSkill!.execute(
        { goal: 'Registry integration test' },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(mockLLM.calls.length).toBeGreaterThan(0);
    });

    it('should find skills by tag', async () => {
      const registry = new SkillRegistry({ allowOverwrite: true });

      registry.register(createPlanningSkill());
      registry.register(createCodeReviewSkill());
      registry.register(createSecurityScanSkill());

      const securitySkills = registry.findByTag('security');
      expect(securitySkills.length).toBeGreaterThan(0);
    });
  });
});
