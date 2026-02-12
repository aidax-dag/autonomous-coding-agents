/**
 * TDD Workflow Skill Tests
 */

import { TddWorkflowSkill, createTddWorkflowSkill } from '../../../../src/core/skills/skills/tdd-workflow-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('TddWorkflowSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new TddWorkflowSkill();
    expect(skill.name).toBe('tdd-workflow');
    expect(skill.description).toContain('test-driven development');
    expect(skill.tags).toContain('tdd');
    expect(skill.tags).toContain('testing');
    expect(skill.tags).toContain('workflow');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new TddWorkflowSkill();
    expect(skill.validate({ feature: 'user login' })).toBe(true);
    expect(skill.validate({ feature: 'auth', framework: 'jest' })).toBe(true);
    expect(skill.validate({ feature: '' })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new TddWorkflowSkill();
    expect(skill.canHandle({ feature: 'user login' })).toBe(true);
    expect(skill.canHandle({ feature: '' })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new TddWorkflowSkill({
      executor: async (input) => ({
        tests: [{ name: 'login test', description: 'Test login flow', code: 'test("login", ...)' }],
        implementation: `function login() { /* ${input.feature} */ }`,
        refactorSuggestions: ['Extract validation'],
      }),
    });

    const result = await skill.execute({ feature: 'user login' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.tests).toHaveLength(1);
    expect(result.output!.implementation).toContain('user login');
    expect(result.output!.refactorSuggestions).toHaveLength(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new TddWorkflowSkill();
    const result = await skill.execute({ feature: 'password reset' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.tests).toHaveLength(1);
    expect(result.output!.tests[0].name).toContain('password reset');
    expect(result.output!.implementation).toContain('password reset');
    expect(result.output!.refactorSuggestions).toHaveLength(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new TddWorkflowSkill();
    const result = await skill.execute({ feature: '' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('feature description is required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new TddWorkflowSkill({
      executor: async () => { throw new Error('tdd workflow error'); },
    });

    const result = await skill.execute({ feature: 'test' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('tdd workflow error');
  });

  it('should create via factory function', () => {
    const skill = createTddWorkflowSkill();
    expect(skill).toBeInstanceOf(TddWorkflowSkill);
    expect(skill.name).toBe('tdd-workflow');
  });
});
