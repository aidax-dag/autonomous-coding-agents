/**
 * CI/CD Skill Tests
 */

import { CicdSkill, createCicdSkill } from '../../../../src/core/skills/skills/cicd-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('CicdSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new CicdSkill();
    expect(skill.name).toBe('cicd');
    expect(skill.description).toContain('CI/CD');
    expect(skill.tags).toContain('cicd');
    expect(skill.tags).toContain('deployment');
    expect(skill.tags).toContain('pipeline');
    expect(skill.tags).toContain('automation');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new CicdSkill();
    expect(skill.validate({ platform: 'github-actions', project: 'my-app' })).toBe(true);
    expect(skill.validate({ platform: 'gitlab-ci', project: 'my-app' })).toBe(true);
    expect(skill.validate({ platform: 'jenkins', project: 'my-app' })).toBe(true);
    expect(skill.validate({ platform: 'circleci', project: 'my-app' })).toBe(true);
    expect(skill.validate({ platform: 'invalid' as any, project: 'my-app' })).toBe(false);
    expect(skill.validate({ platform: 'github-actions', project: '' })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new CicdSkill();
    expect(skill.canHandle({ platform: 'github-actions', project: 'app' })).toBe(true);
    expect(skill.canHandle({ platform: 'invalid', project: 'app' })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new CicdSkill({
      executor: async (input) => ({
        config: `name: ${input.project}\non: push`,
        stages: [{ name: 'build', steps: ['npm ci', 'npm run build'] }],
        recommendations: ['Add caching'],
      }),
    });

    const result = await skill.execute({ platform: 'github-actions', project: 'my-app' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.config).toContain('my-app');
    expect(result.output!.stages).toHaveLength(1);
    expect(result.output!.recommendations).toHaveLength(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior for github-actions', async () => {
    const skill = new CicdSkill();
    const result = await skill.execute({ platform: 'github-actions', project: 'my-app' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.config).toContain('my-app');
    expect(result.output!.config).toContain('ubuntu-latest');
    expect(result.output!.stages).toHaveLength(3); // build, test, deploy
    expect(result.output!.recommendations).toHaveLength(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior for jenkins', async () => {
    const skill = new CicdSkill();
    const result = await skill.execute({ platform: 'jenkins', project: 'my-app' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.config).toContain('pipeline');
    expect(result.output!.config).toContain('my-app');
  });

  it('should respect custom stages', async () => {
    const skill = new CicdSkill();
    const result = await skill.execute({
      platform: 'gitlab-ci',
      project: 'my-app',
      stages: ['lint', 'build'],
    }, context);

    expect(result.success).toBe(true);
    expect(result.output!.stages).toHaveLength(2);
    expect(result.output!.stages[0].name).toBe('lint');
    expect(result.output!.stages[1].name).toBe('build');
  });

  it('should fail on invalid input', async () => {
    const skill = new CicdSkill();
    const result = await skill.execute({ platform: 'invalid' as any, project: 'app' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('platform and project are required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new CicdSkill({
      executor: async () => { throw new Error('pipeline generation failed'); },
    });

    const result = await skill.execute({ platform: 'github-actions', project: 'app' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('pipeline generation failed');
  });

  it('should create via factory function', () => {
    const skill = createCicdSkill();
    expect(skill).toBeInstanceOf(CicdSkill);
    expect(skill.name).toBe('cicd');
  });
});
