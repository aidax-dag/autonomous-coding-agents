/**
 * Git Workflow Skill Tests
 */

import { GitWorkflowSkill, createGitWorkflowSkill } from '../../../../src/core/skills/skills/git-workflow-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('GitWorkflowSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new GitWorkflowSkill();
    expect(skill.name).toBe('git-workflow');
    expect(skill.description).toContain('git operations');
    expect(skill.tags).toContain('git');
    expect(skill.tags).toContain('workflow');
    expect(skill.tags).toContain('vcs');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new GitWorkflowSkill();
    expect(skill.validate({ operation: 'commit' })).toBe(true);
    expect(skill.validate({ operation: 'branch' })).toBe(true);
    expect(skill.validate({ operation: 'pr' })).toBe(true);
    expect(skill.validate({ operation: 'status' })).toBe(true);
    expect(skill.validate({ operation: 'invalid' as any })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new GitWorkflowSkill();
    expect(skill.canHandle({ operation: 'commit' })).toBe(true);
    expect(skill.canHandle({ operation: 'invalid' })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new GitWorkflowSkill({
      executor: async (input) => ({
        operation: input.operation,
        success: true,
        details: 'Custom commit done',
        artifacts: { hash: 'abc123' },
      }),
    });

    const result = await skill.execute({ operation: 'commit', message: 'test' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.artifacts!.hash).toBe('abc123');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new GitWorkflowSkill();
    const result = await skill.execute({ operation: 'status' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.operation).toBe('status');
    expect(result.output!.success).toBe(true);
    expect(result.output!.details).toContain('status');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new GitWorkflowSkill();
    const result = await skill.execute({ operation: 'invalid' as any }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('operation must be');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new GitWorkflowSkill({
      executor: async () => { throw new Error('git error'); },
    });

    const result = await skill.execute({ operation: 'commit' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('git error');
  });

  it('should create via factory function', () => {
    const skill = createGitWorkflowSkill();
    expect(skill).toBeInstanceOf(GitWorkflowSkill);
    expect(skill.name).toBe('git-workflow');
  });
});
