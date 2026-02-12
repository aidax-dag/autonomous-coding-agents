/**
 * Debugging Skill Tests
 */

import { DebuggingSkill, createDebuggingSkill } from '../../../../src/core/skills/skills/debugging-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('DebuggingSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new DebuggingSkill();
    expect(skill.name).toBe('debugging');
    expect(skill.description).toContain('root causes');
    expect(skill.tags).toContain('debug');
    expect(skill.tags).toContain('troubleshoot');
    expect(skill.tags).toContain('error-analysis');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new DebuggingSkill();
    expect(skill.validate({ error: 'TypeError: x is undefined' })).toBe(true);
    expect(skill.validate({ error: 'err', stackTrace: 'at line 1' })).toBe(true);
    expect(skill.validate({ error: '' })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new DebuggingSkill();
    expect(skill.canHandle({ error: 'some error' })).toBe(true);
    expect(skill.canHandle({ error: '' })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new DebuggingSkill({
      executor: async (_input) => ({
        rootCause: 'Null reference in auth module',
        hypothesis: ['Missing null check', 'Race condition'],
        suggestedFixes: [{ description: 'Add null guard', file: 'auth.ts', code: 'if (!user) return;' }],
        confidence: 0.85,
      }),
    });

    const result = await skill.execute({ error: 'TypeError' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.rootCause).toContain('Null reference');
    expect(result.output!.hypothesis).toHaveLength(2);
    expect(result.output!.confidence).toBe(0.85);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new DebuggingSkill();
    const result = await skill.execute({ error: 'TypeError: x is undefined' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.rootCause).toContain('TypeError');
    expect(result.output!.hypothesis).toHaveLength(1);
    expect(result.output!.suggestedFixes).toHaveLength(1);
    expect(result.output!.confidence).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new DebuggingSkill();
    const result = await skill.execute({ error: '' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('error message is required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new DebuggingSkill({
      executor: async () => { throw new Error('analysis crashed'); },
    });

    const result = await skill.execute({ error: 'some error' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('analysis crashed');
  });

  it('should create via factory function', () => {
    const skill = createDebuggingSkill();
    expect(skill).toBeInstanceOf(DebuggingSkill);
    expect(skill.name).toBe('debugging');
  });
});
