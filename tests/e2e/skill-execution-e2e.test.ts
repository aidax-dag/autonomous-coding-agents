/**
 * E2E: Skill Execution
 *
 * Verifies the SkillRegistry discovery/registration, SkillPipeline
 * execution flow, skill execution with mock context, validation,
 * and error handling.
 */

import { createSkillRegistry } from '@/core/skills/skill-registry';
import { createSkillPipeline } from '@/core/skills/skill-pipeline';
import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '@/core/skills/interfaces/skill.interface';

/**
 * Helper to create a mock skill for testing
 */
function createMockSkill(overrides: {
  name: string;
  tags?: string[];
  executeFn?: (input: unknown, ctx: SkillContext) => Promise<SkillResult>;
  canHandleFn?: (input: unknown, ctx: SkillContext) => boolean;
  validateFn?: (input: unknown) => boolean;
}): ISkill {
  return {
    name: overrides.name,
    description: `Mock skill: ${overrides.name}`,
    tags: overrides.tags ?? ['test'],
    version: '1.0.0',

    execute: overrides.executeFn ?? (async (input) => ({
      success: true,
      output: { processed: input },
      duration: 1,
    })),

    canHandle: overrides.canHandleFn,
    validate: overrides.validateFn,
  };
}

const mockContext: SkillContext = {
  workspaceDir: '/tmp/skill-test',
  projectContext: 'test project',
  timeout: 5000,
};

describe('E2E: Skill Execution', () => {
  // ═══════════════════════════════════════════════════════════
  // 1. SkillRegistry discovery and registration
  // ═══════════════════════════════════════════════════════════

  describe('SkillRegistry discovery and registration', () => {
    it('should register and retrieve skills by name', () => {
      const registry = createSkillRegistry();
      const skill = createMockSkill({ name: 'code-review' });

      registry.register(skill);

      expect(registry.count()).toBe(1);
      expect(registry.get('code-review')).toBe(skill);
    });

    it('should reject duplicate skill names by default', () => {
      const registry = createSkillRegistry();
      const skillA = createMockSkill({ name: 'lint' });
      const skillB = createMockSkill({ name: 'lint' });

      registry.register(skillA);
      expect(() => registry.register(skillB)).toThrow(/already registered/);
    });

    it('should allow overwriting when allowOverwrite is true', () => {
      const registry = createSkillRegistry({ allowOverwrite: true });
      const skillA = createMockSkill({ name: 'lint' });
      const skillB = createMockSkill({ name: 'lint', tags: ['updated'] });

      registry.register(skillA);
      registry.register(skillB);

      const retrieved = registry.get('lint');
      expect(retrieved!.tags).toContain('updated');
    });

    it('should find skills by tag', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'lint', tags: ['quality', 'code'] }));
      registry.register(createMockSkill({ name: 'format', tags: ['quality', 'style'] }));
      registry.register(createMockSkill({ name: 'deploy', tags: ['ops'] }));

      const qualitySkills = registry.findByTag('quality');
      expect(qualitySkills).toHaveLength(2);

      const opsSkills = registry.findByTag('ops');
      expect(opsSkills).toHaveLength(1);
      expect(opsSkills[0].name).toBe('deploy');
    });

    it('should find skills by capability', () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'typescript-skill',
          canHandleFn: (input) => typeof input === 'string' && input.endsWith('.ts'),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'python-skill',
          canHandleFn: (input) => typeof input === 'string' && input.endsWith('.py'),
        }),
      );

      const tsSkills = registry.findByCapability('file.ts', mockContext);
      expect(tsSkills).toHaveLength(1);
      expect(tsSkills[0].name).toBe('typescript-skill');

      const pySkills = registry.findByCapability('file.py', mockContext);
      expect(pySkills).toHaveLength(1);
      expect(pySkills[0].name).toBe('python-skill');

      const jsSkills = registry.findByCapability('file.js', mockContext);
      expect(jsSkills).toHaveLength(0);
    });

    it('should list all registered skills', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'skill-a' }));
      registry.register(createMockSkill({ name: 'skill-b' }));
      registry.register(createMockSkill({ name: 'skill-c' }));

      const list = registry.list();
      expect(list).toHaveLength(3);
      expect(list.map((s) => s.name)).toEqual(
        expect.arrayContaining(['skill-a', 'skill-b', 'skill-c']),
      );
    });

    it('should unregister skills', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'removable' }));

      expect(registry.count()).toBe(1);
      const removed = registry.unregister('removable');
      expect(removed).toBe(true);
      expect(registry.count()).toBe(0);
      expect(registry.get('removable')).toBeUndefined();
    });

    it('should clear all skills', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'a' }));
      registry.register(createMockSkill({ name: 'b' }));

      registry.clear();
      expect(registry.count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Skill execution with mock context
  // ═══════════════════════════════════════════════════════════

  describe('Skill execution with mock context', () => {
    it('should execute a skill and return a result', async () => {
      const skill = createMockSkill({
        name: 'analyzer',
        executeFn: async (input, ctx) => ({
          success: true,
          output: { analyzed: input, workspace: ctx.workspaceDir },
          duration: 42,
        }),
      });

      const result = await skill.execute('test-input', mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        analyzed: 'test-input',
        workspace: '/tmp/skill-test',
      });
      expect(result.duration).toBe(42);
    });

    it('should return failure result when skill execution fails', async () => {
      const skill = createMockSkill({
        name: 'failing-skill',
        executeFn: async () => ({
          success: false,
          error: 'Analysis failed: invalid input format',
          duration: 5,
        }),
      });

      const result = await skill.execute('bad-input', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid input format');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. SkillPipeline execution flow
  // ═══════════════════════════════════════════════════════════

  describe('SkillPipeline execution flow', () => {
    it('should chain skills sequentially and pass output as next input', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'step-1',
          executeFn: async (input) => ({
            success: true,
            output: `${input}->step1`,
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'step-2',
          executeFn: async (input) => ({
            success: true,
            output: `${input}->step2`,
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'step-3',
          executeFn: async (input) => ({
            success: true,
            output: `${input}->step3`,
            duration: 1,
          }),
        }),
      );

      const pipeline = createSkillPipeline({ name: 'chain-test', registry });
      pipeline.addStep('step-1').addStep('step-2').addStep('step-3');

      const result = await pipeline.execute('start', mockContext);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(3);
      expect(result.finalOutput).toBe('start->step1->step2->step3');
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should stop on failure when stopOnFailure is true (default)', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'succeeding',
          executeFn: async () => ({
            success: true,
            output: 'ok',
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'failing',
          executeFn: async () => ({
            success: false,
            error: 'Step failed',
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'unreachable',
          executeFn: async () => ({
            success: true,
            output: 'should not run',
            duration: 1,
          }),
        }),
      );

      const pipeline = createSkillPipeline({ name: 'stop-test', registry });
      pipeline.addStep('succeeding').addStep('failing').addStep('unreachable');

      const result = await pipeline.execute('input', mockContext);

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].success).toBe(true);
      expect(result.steps[1].success).toBe(false);
    });

    it('should continue on failure when stopOnFailure is false', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'step-a',
          executeFn: async () => ({
            success: false,
            error: 'Failed',
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'step-b',
          executeFn: async () => ({
            success: true,
            output: 'recovered',
            duration: 1,
          }),
        }),
      );

      const pipeline = createSkillPipeline({
        name: 'continue-test',
        registry,
        stopOnFailure: false,
      });
      pipeline.addStep('step-a').addStep('step-b');

      const result = await pipeline.execute('input', mockContext);

      expect(result.success).toBe(false); // overall fails because step-a failed
      expect(result.steps).toHaveLength(2);
      expect(result.steps[1].success).toBe(true);
    });

    it('should skip steps when condition returns false', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'always-run',
          executeFn: async () => ({
            success: true,
            output: 'ran',
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'conditional',
          executeFn: async () => ({
            success: true,
            output: 'should-be-skipped',
            duration: 1,
          }),
        }),
      );

      const pipeline = createSkillPipeline({ name: 'condition-test', registry });
      pipeline.addStep('always-run');
      pipeline.addStep('conditional', { condition: () => false });

      const result = await pipeline.execute('input', mockContext);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[1].skipped).toBe(true);
    });

    it('should use fallback skill when primary fails', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'primary',
          executeFn: async () => ({
            success: false,
            error: 'Primary failed',
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'fallback',
          executeFn: async () => ({
            success: true,
            output: 'fallback-result',
            duration: 1,
          }),
        }),
      );

      const pipeline = createSkillPipeline({ name: 'fallback-test', registry });
      pipeline.addStep('primary', { fallback: 'fallback' });

      const result = await pipeline.execute('input', mockContext);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].skillName).toContain('fallback');
      expect(result.finalOutput).toBe('fallback-result');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Pipeline validation
  // ═══════════════════════════════════════════════════════════

  describe('Pipeline validation', () => {
    it('should report valid pipeline when all skills exist', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'step-1' }));
      registry.register(createMockSkill({ name: 'step-2' }));

      const pipeline = createSkillPipeline({ name: 'valid-pipeline', registry });
      pipeline.addStep('step-1').addStep('step-2');

      const validation = pipeline.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report invalid pipeline when skills are missing', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'step-1' }));

      const pipeline = createSkillPipeline({ name: 'invalid-pipeline', registry });
      pipeline.addStep('step-1').addStep('non-existent');

      const validation = pipeline.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('non-existent');
    });

    it('should report invalid pipeline when empty', () => {
      const registry = createSkillRegistry();
      const pipeline = createSkillPipeline({ name: 'empty-pipeline', registry });

      const validation = pipeline.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Pipeline has no steps');
    });

    it('should report invalid pipeline when fallback skill is missing', () => {
      const registry = createSkillRegistry();
      registry.register(createMockSkill({ name: 'step-1' }));

      const pipeline = createSkillPipeline({ name: 'bad-fallback', registry });
      pipeline.addStep('step-1', { fallback: 'missing-fallback' });

      const validation = pipeline.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('missing-fallback'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Skill error handling
  // ═══════════════════════════════════════════════════════════

  describe('Skill error handling', () => {
    it('should handle skill that throws during execution', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'throwing-skill',
          executeFn: async () => {
            throw new Error('Unexpected execution error');
          },
        }),
      );

      const pipeline = createSkillPipeline({ name: 'throw-test', registry });
      pipeline.addStep('throwing-skill');

      const result = await pipeline.execute('input', mockContext);

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].success).toBe(false);
      expect(result.steps[0].error).toContain('Unexpected execution error');
    });

    it('should handle pipeline step for non-existent skill', async () => {
      const registry = createSkillRegistry();

      const pipeline = createSkillPipeline({ name: 'missing-skill-test', registry });
      pipeline.addStep('does-not-exist');

      const result = await pipeline.execute('input', mockContext);

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toContain('not found');
    });

    it('should apply transform to successful step output', async () => {
      const registry = createSkillRegistry();

      registry.register(
        createMockSkill({
          name: 'producer',
          executeFn: async () => ({
            success: true,
            output: { value: 10 },
            duration: 1,
          }),
        }),
      );

      registry.register(
        createMockSkill({
          name: 'consumer',
          executeFn: async (input) => ({
            success: true,
            output: input,
            duration: 1,
          }),
        }),
      );

      const pipeline = createSkillPipeline({ name: 'transform-test', registry });
      pipeline.addStep('producer', {
        transform: (output: unknown) => {
          const data = output as { value: number };
          return { value: data.value * 2 };
        },
      });
      pipeline.addStep('consumer');

      const result = await pipeline.execute('initial', mockContext);

      expect(result.success).toBe(true);
      expect(result.finalOutput).toEqual({ value: 20 });
    });
  });
});
