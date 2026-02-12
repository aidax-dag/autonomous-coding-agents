/**
 * Git Workflow Skill
 *
 * Manages git operations including commit, branch, PR, and status workflows.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';

/**
 * Input for git workflow skill
 */
export interface GitWorkflowSkillInput {
  /** Git operation to perform */
  operation: 'commit' | 'branch' | 'pr' | 'status';
  /** Commit or PR message */
  message?: string;
  /** Branch name */
  branch?: string;
  /** Files to stage/operate on */
  files?: string[];
}

/**
 * Output from git workflow skill
 */
export interface GitWorkflowSkillOutput {
  /** The operation that was performed */
  operation: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable details */
  details: string;
  /** Additional artifacts (e.g., branch name, commit hash, PR URL) */
  artifacts?: Record<string, string>;
}

/**
 * Git workflow skill — manages git operations
 */
export class GitWorkflowSkill
  implements ISkill<GitWorkflowSkillInput, GitWorkflowSkillOutput>
{
  readonly name = 'git-workflow';
  readonly description = 'Manages git operations including commit, branch, PR, and status workflows';
  readonly tags = ['git', 'workflow', 'vcs'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: GitWorkflowSkillInput,
    context: SkillContext,
  ) => Promise<GitWorkflowSkillOutput>;

  constructor(options?: {
    executor?: (
      input: GitWorkflowSkillInput,
      context: SkillContext,
    ) => Promise<GitWorkflowSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: GitWorkflowSkillInput): boolean {
    const validOps = ['commit', 'branch', 'pr', 'status'];
    return typeof input.operation === 'string' && validOps.includes(input.operation);
  }

  canHandle(input: unknown): boolean {
    const typed = input as GitWorkflowSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.operation === 'string' &&
      ['commit', 'branch', 'pr', 'status'].includes(typed.operation)
    );
  }

  async execute(
    input: GitWorkflowSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<GitWorkflowSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: operation must be commit, branch, pr, or status',
        duration: Date.now() - start,
      };
    }

    try {
      if (this.executor) {
        const output = await this.executor(input, context);
        return {
          success: true,
          output,
          duration: Date.now() - start,
        };
      }

      // Default stub output
      const output: GitWorkflowSkillOutput = {
        operation: input.operation,
        success: true,
        details: `Executed ${input.operation} operation in ${context.workspaceDir}`,
        artifacts: {},
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }
}

/**
 * Factory function
 */
export function createGitWorkflowSkill(options?: {
  executor?: (
    input: GitWorkflowSkillInput,
    context: SkillContext,
  ) => Promise<GitWorkflowSkillOutput>;
}): GitWorkflowSkill {
  return new GitWorkflowSkill(options);
}
