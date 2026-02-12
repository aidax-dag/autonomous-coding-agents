/**
 * Performance Skill Tests
 */

import { PerformanceSkill, createPerformanceSkill } from '../../../../src/core/skills/skills/performance-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('PerformanceSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new PerformanceSkill();
    expect(skill.name).toBe('performance');
    expect(skill.description).toContain('performance bottlenecks');
    expect(skill.tags).toContain('performance');
    expect(skill.tags).toContain('optimization');
    expect(skill.tags).toContain('profiling');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new PerformanceSkill();
    expect(skill.validate({ files: ['a.ts'] })).toBe(true);
    expect(skill.validate({ files: ['a.ts'], metrics: ['time', 'memory'] })).toBe(true);
    expect(skill.validate({ files: [] })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new PerformanceSkill();
    expect(skill.canHandle({ files: ['a.ts'] })).toBe(true);
    expect(skill.canHandle({ files: [] })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new PerformanceSkill({
      executor: async (input) => ({
        findings: [{ file: input.files[0], issue: 'O(n^2) loop', impact: 'high', suggestion: 'Use hash map' }],
        overallScore: 60,
        bottlenecks: ['nested loops in process()'],
      }),
    });

    const result = await skill.execute({ files: ['app.ts'] }, context);
    expect(result.success).toBe(true);
    expect(result.output!.findings).toHaveLength(1);
    expect(result.output!.overallScore).toBe(60);
    expect(result.output!.bottlenecks).toHaveLength(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new PerformanceSkill();
    const result = await skill.execute({ files: ['a.ts', 'b.ts'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.findings).toHaveLength(0);
    expect(result.output!.overallScore).toBe(100);
    expect(result.output!.bottlenecks).toHaveLength(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new PerformanceSkill();
    const result = await skill.execute({ files: [] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('files array is required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new PerformanceSkill({
      executor: async () => { throw new Error('profiling error'); },
    });

    const result = await skill.execute({ files: ['a.ts'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('profiling error');
  });

  it('should create via factory function', () => {
    const skill = createPerformanceSkill();
    expect(skill).toBeInstanceOf(PerformanceSkill);
    expect(skill.name).toBe('performance');
  });
});
