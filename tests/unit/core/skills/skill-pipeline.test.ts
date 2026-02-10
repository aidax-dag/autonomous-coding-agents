/**
 * SkillPipeline Tests
 */

import { SkillPipeline, createSkillPipeline } from '../../../../src/core/skills/skill-pipeline';
import { SkillRegistry } from '../../../../src/core/skills/skill-registry';
import type { ISkill, SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

function createMockSkill(
  name: string,
  handler: (input: unknown) => unknown = (input) => input,
  shouldFail = false,
): ISkill {
  return {
    name,
    description: `Mock ${name}`,
    tags: ['test'],
    version: '1.0.0',
    execute: async (input) => {
      if (shouldFail) {
        return { success: false, error: `${name} failed`, duration: 1 };
      }
      return { success: true, output: handler(input), duration: 1 };
    },
  };
}

describe('SkillPipeline', () => {
  let registry: SkillRegistry;
  const context: SkillContext = { workspaceDir: '/tmp' };

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('should execute steps sequentially', async () => {
    registry.register(createMockSkill('step1', () => 'from-step1'));
    registry.register(createMockSkill('step2', (input) => `${input}+step2`));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('step1').addStep('step2');

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.finalOutput).toBe('from-step1+step2');
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('should stop on failure by default', async () => {
    registry.register(createMockSkill('ok', () => 'ok'));
    registry.register(createMockSkill('fail', () => null, true));
    registry.register(createMockSkill('after', () => 'should-not-run'));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('ok').addStep('fail').addStep('after');

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(2); // stopped at 'fail', 'after' never ran
    expect(result.steps[0].success).toBe(true);
    expect(result.steps[1].success).toBe(false);
  });

  it('should continue on failure when stopOnFailure is false', async () => {
    registry.register(createMockSkill('ok', () => 'ok'));
    registry.register(createMockSkill('fail', () => null, true));
    registry.register(createMockSkill('after', () => 'ran'));

    const pipeline = new SkillPipeline({ name: 'test', registry, stopOnFailure: false });
    pipeline.addStep('ok').addStep('fail').addStep('after');

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(false); // overall still false
    expect(result.steps).toHaveLength(3); // all ran
    expect(result.steps[2].success).toBe(true);
  });

  it('should skip steps when condition returns false', async () => {
    registry.register(createMockSkill('always', () => 'yes'));
    registry.register(createMockSkill('sometimes', () => 'should-skip'));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('always').addStep('sometimes', { condition: () => false });

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].skipped).toBe(true);
    expect(result.finalOutput).toBe('yes'); // kept output from 'always'
  });

  it('should apply transform to step output', async () => {
    registry.register(createMockSkill('produce', () => 42));
    registry.register(createMockSkill('consume', (input) => `got:${input}`));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('produce', { transform: (out) => (out as number) * 2 });
    pipeline.addStep('consume');

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(true);
    expect(result.finalOutput).toBe('got:84');
  });

  it('should use fallback on step failure', async () => {
    registry.register(createMockSkill('flaky', () => null, true));
    registry.register(createMockSkill('backup', () => 'fallback-result'));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('flaky', { fallback: 'backup' });

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(true);
    expect(result.steps[0].skillName).toBe('flaky→backup');
    expect(result.finalOutput).toBe('fallback-result');
  });

  it('should handle missing skill in step', async () => {
    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('nonexistent');

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(false);
    expect(result.steps[0].error).toContain("Skill 'nonexistent' not found");
  });

  it('should handle execution errors', async () => {
    registry.register({
      name: 'throws',
      description: 'Throws',
      tags: ['test'],
      version: '1.0.0',
      execute: async () => {
        throw new Error('boom');
      },
    });

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('throws');

    const result = await pipeline.execute('start', context);

    expect(result.success).toBe(false);
    expect(result.steps[0].error).toBe('boom');
  });

  it('should validate pipeline', () => {
    registry.register(createMockSkill('exists'));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('exists').addStep('missing');

    const validation = pipeline.validate();

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Skill 'missing' not found in registry");
  });

  it('should report empty pipeline as invalid', () => {
    const pipeline = new SkillPipeline({ name: 'test', registry });
    const validation = pipeline.validate();

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Pipeline has no steps');
  });

  it('should validate fallback references', () => {
    registry.register(createMockSkill('step'));

    const pipeline = new SkillPipeline({ name: 'test', registry });
    pipeline.addStep('step', { fallback: 'missing-fallback' });

    const validation = pipeline.validate();

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Fallback skill 'missing-fallback' not found in registry");
  });

  it('should report stepCount', () => {
    const pipeline = new SkillPipeline({ name: 'test', registry });
    expect(pipeline.stepCount).toBe(0);

    pipeline.addStep('a').addStep('b');
    expect(pipeline.stepCount).toBe(2);
  });

  it('should be created via factory function', () => {
    const pipeline = createSkillPipeline({ name: 'test', registry });
    expect(pipeline).toBeInstanceOf(SkillPipeline);
  });
});
