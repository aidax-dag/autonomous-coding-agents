import { BaseAgent } from '@/agents/base/agent';
import {
  AgentConfig,
  AgentType,
  Task,
  TaskResult,
  TaskStatus,
  ImplementationRequest,
  ImplementationResult,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { ILLMClient } from '@/shared/llm/base-client';
import { GitOperations } from '@/shared/git/operations';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Coder Agent
 *
 * Responsible for implementing code changes based on requirements.
 * Uses LLM for code generation and Git for version control.
 *
 * Follows strict quality standards:
 * - Zod validation for all external data
 * - Explicit error handling with retries
 * - Resource cleanup in finally blocks
 * - No any types
 *
 * Feature: F2.3 - Coder Agent
 */

/**
 * Implementation request payload schema
 */
const ImplementationPayloadSchema = z.object({
  repository: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    url: z.string().url(),
  }),
  branch: z.string().optional(),
  featureBranch: z.string().optional(),
  feature: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    requirements: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()).optional(),
  }),
  context: z
    .object({
      relatedFiles: z.array(z.string()).optional(),
      existingCode: z.record(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * LLM response schema for code generation
 */
const CodeGenerationResponseSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      action: z.enum(['create', 'modify', 'delete']),
    })
  ),
  summary: z.string().optional(),
  tests: z.array(z.string()).optional(),
});

type CodeGenerationResponse = z.infer<typeof CodeGenerationResponseSchema>;

interface FileChange {
  path: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
}

interface SyntaxValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Coder Agent Implementation
 */
export class CoderAgent extends BaseAgent {
  private customLLMClient?: ILLMClient;
  private workDir: string;

  constructor(config: AgentConfig, natsClient: NatsClient, llmClient?: ILLMClient) {
    super(config, natsClient);
    this.customLLMClient = llmClient;
    this.workDir = process.env.WORK_DIR || '/tmp/coder-agent';
  }

  getAgentType(): AgentType {
    return AgentType.CODER;
  }

  /**
   * Process implementation task
   */
  async processTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Validate task payload
      const validationResult = ImplementationPayloadSchema.safeParse(
        (task as ImplementationRequest).payload
      );

      if (!validationResult.success) {
        throw new AgentError(
          'Invalid implementation request payload',
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: validationResult.error.errors }
        );
      }

      const payload = validationResult.data;
      const { repository, feature, featureBranch } = payload;

      this.logger.info('Processing implementation request', {
        taskId: task.id,
        feature: feature.title,
      });

      // Clone repository
      const repoPath = await this.cloneRepository(repository.url);
      let gitOps: GitOperations | undefined;

      try {
        gitOps = new GitOperations({ repoPath });

        // Create and checkout feature branch
        const branchName = featureBranch || `feature/${this.generateBranchName(feature.title)}`;
        await this.createFeatureBranch(gitOps, branchName);

        // Generate code using LLM
        const codeGeneration = await this.generateCode(feature);

        // Apply file changes
        await this.applyFileChanges(codeGeneration.files, repoPath);

        // Validate syntax
        const validationResults = await this.validateGeneratedCode(
          codeGeneration.files,
          repoPath
        );

        // Commit changes
        const changedFiles = codeGeneration.files.map((f) => f.path);
        const commitMessage = `feat: ${feature.title}\n\n${feature.description}`;
        const commitSha = await this.commitChanges(gitOps, changedFiles, commitMessage);

        // Push to remote
        await this.pushChanges(gitOps, branchName);

        // Build result
        const result: ImplementationResult = {
          taskId: task.id,
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            repository: {
              owner: repository.owner,
              repo: repository.repo,
            },
            branch: branchName,
            commits: [
              {
                sha: commitSha,
                message: commitMessage,
                files: changedFiles,
              },
            ],
            filesChanged: codeGeneration.files.map((f) => ({
              path: f.path,
              status: f.action === 'create' ? 'added' : f.action === 'delete' ? 'deleted' : 'modified',
              additions: f.content.split('\n').length,
              deletions: 0,
            })),
            summary: codeGeneration.summary || `Implemented ${feature.title}`,
            validationResults: {
              syntaxCheck: validationResults.every((r) => r.valid),
              errors: validationResults.flatMap((r) => r.errors || []),
            },
          },
        };

        this.logger.info('Implementation completed successfully', {
          taskId: task.id,
          branch: branchName,
          filesChanged: codeGeneration.files.length,
        });

        return result;
      } finally {
        // Cleanup: remove cloned repository
        await this.cleanupRepository(repoPath);
      }
    } catch (error) {
      this.logger.error('Implementation failed', {
        taskId: task.id,
        error,
      });

      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        success: false,
        error: {
          code: error instanceof AgentError ? error.code : ErrorCode.IMPLEMENTATION_FAILED,
          message: error instanceof Error ? error.message : String(error),
          details: error instanceof AgentError ? error.context : undefined,
        },
        metadata: {
          completedAt: Date.now(),
          duration: Date.now() - startTime,
          agentId: this.config.id,
        },
      };
    }
  }

  /**
   * Clone repository to local directory
   */
  private async cloneRepository(url: string): Promise<string> {
    const repoName = url.split('/').pop()?.replace('.git', '') || 'repo';
    const targetPath = path.join(this.workDir, `${repoName}-${Date.now()}`);

    try {
      await fs.mkdir(targetPath, { recursive: true });
      await GitOperations.clone({
        url,
        targetPath,
        depth: 1,
      });

      this.logger.info('Repository cloned', { url, targetPath });
      return targetPath;
    } catch (error) {
      throw new AgentError(
        'Failed to clone repository',
        ErrorCode.GIT_OPERATION_FAILED,
        false,
        { url, error: String(error) }
      );
    }
  }

  /**
   * Create and checkout feature branch
   */
  private async createFeatureBranch(gitOps: GitOperations, branchName: string): Promise<void> {
    try {
      await gitOps.createBranch(branchName, true);
      this.logger.info('Feature branch created', { branchName });
    } catch (error) {
      throw new AgentError(
        'Failed to create feature branch',
        ErrorCode.GIT_OPERATION_FAILED,
        false,
        { branchName, error: String(error) }
      );
    }
  }

  /**
   * Generate code using LLM with retry logic
   */
  private async generateCode(feature: {
    title: string;
    description: string;
    requirements: string[];
  }): Promise<CodeGenerationResponse> {
    return this.retryWithBackoff(async () => {
      const llm = this.customLLMClient || this.llmClient;

      const prompt = this.buildCodeGenerationPrompt(feature);

      try {
        const response = await llm.chat(
          [
            {
              role: 'system',
              content:
                'You are an expert software engineer. Generate clean, well-tested TypeScript code.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          {
            temperature: 0.2,
            maxTokens: 4000,
          }
        );

        // Parse and validate response
        let parsedContent: unknown;
        try {
          parsedContent = JSON.parse(response.content);
        } catch {
          throw new AgentError(
            'LLM response is not valid JSON',
            ErrorCode.LLM_INVALID_RESPONSE,
            true,
            { content: response.content.substring(0, 200) }
          );
        }

        const validationResult = CodeGenerationResponseSchema.safeParse(parsedContent);
        if (!validationResult.success) {
          throw new AgentError(
            'LLM response does not match expected schema',
            ErrorCode.LLM_INVALID_RESPONSE,
            true,
            { errors: validationResult.error.errors }
          );
        }

        return validationResult.data;
      } catch (error) {
        if (error instanceof AgentError) {
          throw error;
        }

        throw new AgentError(
          'Code generation failed',
          ErrorCode.LLM_API_ERROR,
          true,
          { error: String(error) }
        );
      }
    }, 3);
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable =
          error instanceof AgentError
            ? error.retryable
            : error instanceof Error && error.message.toLowerCase().includes('rate limit');

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        // Wait with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn('Retrying after error', {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: String(error),
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Build prompt for code generation
   */
  private buildCodeGenerationPrompt(feature: {
    title: string;
    description: string;
    requirements: string[];
  }): string {
    return `Generate TypeScript code for the following feature:

Title: ${feature.title}
Description: ${feature.description}

Requirements:
${feature.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Generate code following these guidelines:
- Use TypeScript with strict typing
- Include proper error handling
- Add JSDoc comments
- Follow clean code principles
- Return response in JSON format:
{
  "files": [
    {"path": "src/example.ts", "content": "...", "action": "create"}
  ],
  "summary": "Brief summary of changes"
}`;
  }

  /**
   * Apply file changes to repository
   */
  private async applyFileChanges(files: FileChange[], repoPath: string): Promise<void> {
    for (const file of files) {
      const filePath = path.join(repoPath, file.path);

      try {
        if (file.action === 'delete') {
          await fs.unlink(filePath);
        } else {
          // Ensure directory exists
          await fs.mkdir(path.dirname(filePath), { recursive: true });

          // Write file
          await fs.writeFile(filePath, file.content, 'utf-8');
        }

        this.logger.info('File change applied', {
          path: file.path,
          action: file.action,
        });
      } catch (error) {
        throw new AgentError(
          `Failed to apply file change: ${file.path}`,
          ErrorCode.IMPLEMENTATION_FAILED,
          false,
          { path: file.path, action: file.action, error: String(error) }
        );
      }
    }
  }

  /**
   * Validate generated code syntax
   */
  private async validateGeneratedCode(
    files: FileChange[],
    _repoPath: string
  ): Promise<SyntaxValidationResult[]> {
    const results: SyntaxValidationResult[] = [];

    for (const file of files) {
      if (file.action !== 'delete' && file.path.endsWith('.ts')) {
        const result = await this.validateSyntax(file.content);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Validate TypeScript syntax
   */
  private async validateSyntax(code: string): Promise<SyntaxValidationResult> {
    try {
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      // Check for parse diagnostics (syntax errors)
      const diagnostics = (sourceFile as any).parseDiagnostics || [];
      const errors: string[] = diagnostics.map((diagnostic: ts.Diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        return `${message} at position ${diagnostic.start}`;
      });

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [String(error)],
      };
    }
  }

  /**
   * Commit changes to git
   */
  private async commitChanges(
    gitOps: GitOperations,
    files: string[],
    message: string
  ): Promise<string> {
    try {
      await gitOps.add(files);
      const commitSha = await gitOps.commit({ message });
      this.logger.info('Changes committed', { commitSha, files: files.length });
      return commitSha;
    } catch (error) {
      throw new AgentError(
        'Failed to commit changes',
        ErrorCode.GIT_OPERATION_FAILED,
        false,
        { error: String(error) }
      );
    }
  }

  /**
   * Push changes to remote
   */
  private async pushChanges(gitOps: GitOperations, branch: string): Promise<void> {
    try {
      await gitOps.push('origin', branch);
      this.logger.info('Changes pushed to remote', { branch });
    } catch (error) {
      throw new AgentError(
        'Failed to push changes',
        ErrorCode.GIT_OPERATION_FAILED,
        true,
        { branch, error: String(error) }
      );
    }
  }

  /**
   * Generate branch name from feature title
   */
  private generateBranchName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Cleanup cloned repository
   */
  private async cleanupRepository(_repoPath: string): Promise<void> {
    const repoPath = _repoPath;
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
      this.logger.info('Repository cleaned up', { repoPath });
    } catch (error) {
      // Log but don't throw - cleanup failure shouldn't fail the task
      this.logger.warn('Failed to cleanup repository', {
        repoPath,
        error: String(error),
      });
    }
  }
}
