/**
 * Extracted Skills Tests
 *
 * Tests for skills extracted from team agents.
 */

import { PlanningSkill, createPlanningSkill } from '../../../../src/core/skills/skills/planning-skill';
import { CodeReviewSkill, createCodeReviewSkill } from '../../../../src/core/skills/skills/code-review-skill';
import { TestGenerationSkill, createTestGenerationSkill } from '../../../../src/core/skills/skills/test-generation-skill';
import { RefactoringSkill, createRefactoringSkill } from '../../../../src/core/skills/skills/refactoring-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('PlanningSkill', () => {
  it('should have correct metadata', () => {
    const skill = new PlanningSkill();
    expect(skill.name).toBe('planning');
    expect(skill.tags).toContain('planning');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input', () => {
    const skill = new PlanningSkill();
    expect(skill.validate({ goal: 'test' })).toBe(true);
    expect(skill.validate({ goal: '' })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should execute with default stub', async () => {
    const skill = new PlanningSkill();
    const result = await skill.execute({ goal: 'build auth' }, context);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output!.title).toContain('build auth');
    expect(result.output!.tasks).toHaveLength(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with custom executor', async () => {
    const skill = new PlanningSkill({
      executor: async (input) => ({
        title: `Custom: ${input.goal}`,
        summary: 'custom',
        tasks: [],
      }),
    });

    const result = await skill.execute({ goal: 'test' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.title).toBe('Custom: test');
  });

  it('should fail on invalid input', async () => {
    const skill = new PlanningSkill();
    const result = await skill.execute({ goal: '' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('goal is required');
  });

  it('should handle executor errors', async () => {
    const skill = new PlanningSkill({
      executor: async () => { throw new Error('executor error'); },
    });

    const result = await skill.execute({ goal: 'test' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('executor error');
  });

  it('should be created via factory', () => {
    const skill = createPlanningSkill();
    expect(skill).toBeInstanceOf(PlanningSkill);
  });
});

describe('CodeReviewSkill', () => {
  it('should have correct metadata', () => {
    const skill = new CodeReviewSkill();
    expect(skill.name).toBe('code-review');
    expect(skill.tags).toContain('review');
    expect(skill.tags).toContain('security');
  });

  it('should validate input', () => {
    const skill = new CodeReviewSkill();
    expect(skill.validate({ files: ['a.ts'] })).toBe(true);
    expect(skill.validate({ files: [] })).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new CodeReviewSkill();
    expect(skill.canHandle({ files: ['a.ts'] })).toBe(true);
    expect(skill.canHandle({ files: [] })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with default stub', async () => {
    const skill = new CodeReviewSkill();
    const result = await skill.execute({ files: ['a.ts', 'b.ts'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.findings).toHaveLength(2);
    expect(result.output!.approved).toBe(true);
  });

  it('should execute with custom executor', async () => {
    const skill = new CodeReviewSkill({
      executor: async () => ({
        summary: 'custom',
        findings: [],
        metrics: { complexity: 5, maintainability: 90, testability: 80, security: 95, overall: 85 },
        approved: false,
        reason: 'custom check',
        actionItems: ['fix it'],
      }),
    });

    const result = await skill.execute({ files: ['a.ts'] }, context);
    expect(result.success).toBe(true);
    expect(result.output!.approved).toBe(false);
  });

  it('should be created via factory', () => {
    expect(createCodeReviewSkill()).toBeInstanceOf(CodeReviewSkill);
  });
});

describe('TestGenerationSkill', () => {
  it('should have correct metadata', () => {
    const skill = new TestGenerationSkill();
    expect(skill.name).toBe('test-generation');
    expect(skill.tags).toContain('testing');
  });

  it('should validate input', () => {
    const skill = new TestGenerationSkill();
    expect(skill.validate({ sourceFiles: ['a.ts'] })).toBe(true);
    expect(skill.validate({ sourceFiles: [] })).toBe(false);
  });

  it('should execute with default stub', async () => {
    const skill = new TestGenerationSkill();
    const result = await skill.execute({ sourceFiles: ['a.ts'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.tests).toHaveLength(1);
    expect(result.output!.totalGenerated).toBe(1);
  });

  it('should fail on invalid input', async () => {
    const skill = new TestGenerationSkill();
    const result = await skill.execute({ sourceFiles: [] }, context);
    expect(result.success).toBe(false);
  });

  it('should be created via factory', () => {
    expect(createTestGenerationSkill()).toBeInstanceOf(TestGenerationSkill);
  });
});

describe('RefactoringSkill', () => {
  it('should have correct metadata', () => {
    const skill = new RefactoringSkill();
    expect(skill.name).toBe('refactoring');
    expect(skill.tags).toContain('refactoring');
  });

  it('should validate input', () => {
    const skill = new RefactoringSkill();
    expect(skill.validate({ files: ['a.ts'] })).toBe(true);
    expect(skill.validate({ files: [] })).toBe(false);
  });

  it('should execute with default stub', async () => {
    const skill = new RefactoringSkill();
    const result = await skill.execute({ files: ['a.ts'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.suggestions).toHaveLength(0);
    expect(result.output!.technicalDebtScore).toBe(0);
  });

  it('should handle executor errors', async () => {
    const skill = new RefactoringSkill({
      executor: async () => { throw new Error('refactor error'); },
    });

    const result = await skill.execute({ files: ['a.ts'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('refactor error');
  });

  it('should be created via factory', () => {
    expect(createRefactoringSkill()).toBeInstanceOf(RefactoringSkill);
  });
});
