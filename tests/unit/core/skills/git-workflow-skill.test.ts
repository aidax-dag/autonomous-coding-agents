/**
 * Git Workflow Skill Tests
 */

import { GitWorkflowSkill, createGitWorkflowSkill } from '../../../../src/core/skills/skills/git-workflow-skill';
import { createGitHubExecutor } from '../../../../src/core/skills/skills/git-workflow-executor';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';
import type { GitHubClient } from '../../../../src/shared/github/github-client';

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

describe('GitHubExecutor integration', () => {
  function makeMockGitHubClient(): jest.Mocked<Pick<GitHubClient, 'createPullRequest' | 'getRepository'>> {
    return {
      createPullRequest: jest.fn(),
      getRepository: jest.fn(),
    };
  }

  it('should create a PR via GitHubClient', async () => {
    const mockClient = makeMockGitHubClient();
    mockClient.createPullRequest.mockResolvedValue({
      number: 42,
      title: 'My PR',
      body: null,
      state: 'open',
      htmlUrl: 'https://github.com/owner/repo/pull/42',
      head: { ref: 'feature', sha: 'abc' },
      base: { ref: 'main' },
      draft: false,
      merged: false,
      mergeable: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });

    const executor = createGitHubExecutor({
      githubClient: mockClient as unknown as GitHubClient,
      owner: 'owner',
      repo: 'repo',
    });

    const skill = new GitWorkflowSkill({ executor });
    const result = await skill.execute(
      { operation: 'pr', message: 'My PR', branch: 'feature' },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output!.artifacts!.number).toBe('42');
    expect(result.output!.artifacts!.url).toContain('pull/42');
    expect(mockClient.createPullRequest).toHaveBeenCalledWith('owner', 'repo', {
      title: 'My PR',
      head: 'feature',
      base: 'main',
    });
  });

  it('should fetch repo status via GitHubClient', async () => {
    const mockClient = makeMockGitHubClient();
    mockClient.getRepository.mockResolvedValue({
      name: 'repo',
      fullName: 'owner/repo',
      description: null,
      defaultBranch: 'main',
      private: false,
      htmlUrl: 'https://github.com/owner/repo',
    });

    const executor = createGitHubExecutor({
      githubClient: mockClient as unknown as GitHubClient,
      owner: 'owner',
      repo: 'repo',
    });

    const skill = new GitWorkflowSkill({ executor });
    const result = await skill.execute({ operation: 'status' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.details).toContain('owner/repo');
    expect(result.output!.artifacts!.defaultBranch).toBe('main');
  });

  it('should handle commit/branch as local operations', async () => {
    const mockClient = makeMockGitHubClient();
    const executor = createGitHubExecutor({
      githubClient: mockClient as unknown as GitHubClient,
      owner: 'owner',
      repo: 'repo',
    });

    const skill = new GitWorkflowSkill({ executor });
    const result = await skill.execute({ operation: 'commit', message: 'test' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.operation).toBe('commit');
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
    expect(mockClient.getRepository).not.toHaveBeenCalled();
  });

  it('should propagate GitHubClient errors', async () => {
    const mockClient = makeMockGitHubClient();
    mockClient.createPullRequest.mockRejectedValue(new Error('GitHub API failed'));

    const executor = createGitHubExecutor({
      githubClient: mockClient as unknown as GitHubClient,
      owner: 'owner',
      repo: 'repo',
    });

    const skill = new GitWorkflowSkill({ executor });
    const result = await skill.execute({ operation: 'pr', message: 'Fail' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('GitHub API failed');
  });
});
