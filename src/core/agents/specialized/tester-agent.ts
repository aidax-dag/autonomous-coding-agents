/**
 * Tester Agent
 *
 * DI-based implementation responsible for test execution and generation.
 * Handles running tests, generating test files, analyzing results, and coverage.
 *
 * Follows SOLID principles:
 * - S: Single responsibility - testing tasks
 * - O: Open for extension via hooks
 * - L: Implements IAgent, substitutable
 * - I: Depends only on required interfaces
 * - D: All dependencies injected via constructor
 *
 * Feature: F1.7 - Tester Agent Enhance
 * @module core/agents/specialized
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentDependencies, LLMMessage } from '../interfaces';
import { IAgentConfig, AgentType, AgentCapability, ITask, TaskResult } from '../../interfaces';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Test execution payload schema
 */
export const TestExecutionPayloadSchema = z.object({
  repository: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    path: z.string().optional(),
  }),
  testType: z.enum(['unit', 'integration', 'e2e', 'all']).default('all'),
  testPattern: z.string().optional(),
  coverage: z.boolean().default(true),
  timeout: z.number().positive().default(300000), // 5 minutes default
  parallel: z.boolean().default(true),
  retryFailed: z.boolean().default(false),
  maxRetries: z.number().min(0).max(3).default(1),
});

/**
 * Test generation payload schema
 */
export const TestGenerationPayloadSchema = z.object({
  sourceFile: z.string().min(1),
  sourceCode: z.string().min(1),
  testFramework: z.enum(['jest', 'vitest', 'mocha', 'pytest', 'junit']).default('jest'),
  testType: z.enum(['unit', 'integration']).default('unit'),
  coverage: z
    .object({
      statements: z.number().min(0).max(100).default(80),
      branches: z.number().min(0).max(100).default(80),
      functions: z.number().min(0).max(100).default(80),
      lines: z.number().min(0).max(100).default(80),
    })
    .optional(),
  mockDependencies: z.boolean().default(true),
  includeEdgeCases: z.boolean().default(true),
});

/**
 * Test analysis payload schema
 */
export const TestAnalysisPayloadSchema = z.object({
  testResults: z.object({
    total: z.number().min(0),
    passed: z.number().min(0),
    failed: z.number().min(0),
    skipped: z.number().min(0).optional(),
    duration: z.number().min(0),
  }),
  failedTests: z
    .array(
      z.object({
        name: z.string(),
        error: z.string(),
        stack: z.string().optional(),
        file: z.string().optional(),
      })
    )
    .optional(),
  coverage: z
    .object({
      statements: z.number().min(0).max(100),
      branches: z.number().min(0).max(100),
      functions: z.number().min(0).max(100),
      lines: z.number().min(0).max(100),
    })
    .optional(),
});

/**
 * Generated test response schema
 */
export const GeneratedTestResponseSchema = z.object({
  testFile: z.object({
    path: z.string(),
    content: z.string(),
  }),
  testCases: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      type: z.enum(['unit', 'integration', 'edge-case']),
    })
  ),
  mocks: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        implementation: z.string(),
      })
    )
    .optional(),
  summary: z.string(),
});

/**
 * Test analysis response schema
 */
export const TestAnalysisResponseSchema = z.object({
  summary: z.string(),
  issues: z.array(
    z.object({
      severity: z.enum(['critical', 'warning', 'info']),
      message: z.string(),
      suggestion: z.string().optional(),
      testName: z.string().optional(),
    })
  ),
  recommendations: z.array(z.string()),
  coverageAnalysis: z
    .object({
      status: z.enum(['excellent', 'good', 'needs-improvement', 'critical']),
      gaps: z.array(z.string()),
    })
    .optional(),
});

// Type exports
export type TestExecutionPayload = z.infer<typeof TestExecutionPayloadSchema>;
export type TestGenerationPayload = z.infer<typeof TestGenerationPayloadSchema>;
export type TestAnalysisPayload = z.infer<typeof TestAnalysisPayloadSchema>;
export type GeneratedTestResponse = z.infer<typeof GeneratedTestResponseSchema>;
export type TestAnalysisResponse = z.infer<typeof TestAnalysisResponseSchema>;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Test runner interface for executing tests
 */
export interface ITestRunner {
  runTests(options: {
    pattern?: string;
    testType: 'unit' | 'integration' | 'e2e' | 'all';
    coverage: boolean;
    timeout: number;
    parallel: boolean;
  }): Promise<TestRunResult>;
}

/**
 * Test run result
 */
export interface TestRunResult {
  success: boolean;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failedTests: FailedTest[];
  coverage?: CoverageResult;
  output?: string;
}

/**
 * Failed test details
 */
export interface FailedTest {
  name: string;
  file: string;
  error: string;
  stack?: string;
  duration?: number;
}

/**
 * Coverage result
 */
export interface CoverageResult {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncoveredLines?: Record<string, number[]>;
}

/**
 * Coverage status enumeration
 */
export enum CoverageStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  NEEDS_IMPROVEMENT = 'needs-improvement',
  CRITICAL = 'critical',
}

/**
 * Issue severity enumeration
 */
export enum IssueSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Tester Agent Configuration
 */
export interface TesterAgentConfig extends IAgentConfig {
  testRunner?: ITestRunner;
  defaultTimeout?: number;
  coverageThresholds?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Tester Agent
 *
 * Handles test execution, generation, and analysis.
 */
export class TesterAgent extends BaseAgent {
  private readonly testRunner?: ITestRunner;
  private readonly defaultTimeout: number;
  private readonly coverageThresholds: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  private readonly retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };

  constructor(config: TesterAgentConfig, dependencies: AgentDependencies) {
    super(
      {
        ...config,
        type: AgentType.TESTER,
      },
      dependencies
    );

    this.testRunner = config.testRunner;
    this.defaultTimeout = config.defaultTimeout ?? 300000; // 5 minutes

    this.coverageThresholds = config.coverageThresholds ?? {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    };

    this.retryConfig = config.retry ?? {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };
  }

  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================

  protected async onInitialize(): Promise<void> {
    this.logger.info('TesterAgent initializing', {
      hasTestRunner: !!this.testRunner,
      defaultTimeout: this.defaultTimeout,
      coverageThresholds: this.coverageThresholds,
    });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('TesterAgent disposing');
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  getCapabilities(): AgentCapability[] {
    const capabilities: AgentCapability[] = [
      {
        name: 'test-generation',
        description: 'Generate test files for source code with comprehensive coverage',
        inputSchema: {
          type: 'object',
          properties: {
            sourceFile: { type: 'string' },
            sourceCode: { type: 'string' },
            testFramework: { type: 'string', enum: ['jest', 'vitest', 'mocha', 'pytest', 'junit'] },
            testType: { type: 'string', enum: ['unit', 'integration'] },
          },
          required: ['sourceFile', 'sourceCode'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            testFile: { type: 'object' },
            testCases: { type: 'array' },
            summary: { type: 'string' },
          },
        },
      },
      {
        name: 'test-analysis',
        description: 'Analyze test results and provide recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            testResults: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                passed: { type: 'number' },
                failed: { type: 'number' },
                duration: { type: 'number' },
              },
              required: ['total', 'passed', 'failed', 'duration'],
            },
          },
          required: ['testResults'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            issues: { type: 'array' },
            recommendations: { type: 'array' },
          },
        },
      },
    ];

    // Add test execution capability only if runner is available
    if (this.testRunner) {
      capabilities.unshift({
        name: 'test-execution',
        description: 'Execute tests and report results with coverage',
        inputSchema: {
          type: 'object',
          properties: {
            repository: {
              type: 'object',
              properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
              },
              required: ['owner', 'repo'],
            },
            testType: { type: 'string', enum: ['unit', 'integration', 'e2e', 'all'] },
            coverage: { type: 'boolean' },
          },
          required: ['repository'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            results: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                passed: { type: 'number' },
                failed: { type: 'number' },
                skipped: { type: 'number' },
                duration: { type: 'number' },
              },
            },
            coverage: { type: 'object' },
          },
        },
      });
    }

    return capabilities;
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();

    try {
      switch (task.type) {
        case 'test-execution':
          return await this.handleTestExecution(task, startTime);

        case 'test-generation':
          return await this.handleTestGeneration(task, startTime);

        case 'test-analysis':
          return await this.handleTestAnalysis(task, startTime);

        default:
          return this.createFailureResult(
            task,
            new Error(`Unsupported task type: ${task.type}`),
            startTime
          );
      }
    } catch (error) {
      this.logger.error('Task processing failed', { taskId: task.id, error });
      return this.createFailureResult(
        task,
        error instanceof Error ? error : new Error(String(error)),
        startTime
      );
    }
  }

  // ============================================================================
  // Task Handlers
  // ============================================================================

  /**
   * Handle test execution task
   */
  private async handleTestExecution(task: ITask, startTime: Date): Promise<TaskResult> {
    if (!this.testRunner) {
      return this.createFailureResult(
        task,
        new Error('Test runner not configured'),
        startTime
      );
    }

    const parseResult = TestExecutionPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Executing tests', {
      taskId: task.id,
      testType: payload.testType,
      pattern: payload.testPattern,
    });

    // Execute with retry
    const result = await this.executeWithRetry(
      () =>
        this.testRunner!.runTests({
          pattern: payload.testPattern,
          testType: payload.testType,
          coverage: payload.coverage,
          timeout: payload.timeout,
          parallel: payload.parallel,
        }),
      'test-execution'
    );

    return this.createSuccessResult(task, {
      success: result.success,
      results: {
        total: result.total,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration: result.duration,
      },
      failedTests: result.failedTests,
      coverage: result.coverage,
      output: result.output,
    }, startTime);
  }

  /**
   * Handle test generation task
   */
  private async handleTestGeneration(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = TestGenerationPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Generating tests', {
      taskId: task.id,
      sourceFile: payload.sourceFile,
      testFramework: payload.testFramework,
    });

    // Build LLM prompt
    const systemPrompt = this.buildTestGenerationSystemPrompt(payload);
    const userPrompt = this.buildTestGenerationUserPrompt(payload);

    // Generate tests with LLM
    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'test-generation-llm'
    );

    // Parse response
    const generatedTests = this.parseTestGenerationResponse(response);

    return this.createSuccessResult(task, {
      generatedTests,
      sourceFile: payload.sourceFile,
      testFramework: payload.testFramework,
    }, startTime);
  }

  /**
   * Handle test analysis task
   */
  private async handleTestAnalysis(task: ITask, startTime: Date): Promise<TaskResult> {
    const parseResult = TestAnalysisPayloadSchema.safeParse(task.payload);
    if (!parseResult.success) {
      return this.createFailureResult(
        task,
        new Error(`Invalid payload: ${parseResult.error.message}`),
        startTime
      );
    }

    const payload = parseResult.data;

    this.logger.info('Analyzing test results', {
      taskId: task.id,
      total: payload.testResults.total,
      failed: payload.testResults.failed,
    });

    // Build LLM prompt
    const systemPrompt = this.buildTestAnalysisSystemPrompt();
    const userPrompt = this.buildTestAnalysisUserPrompt(payload);

    // Analyze with LLM
    const response = await this.executeWithRetry(
      () => this.callLLM(systemPrompt, userPrompt),
      'test-analysis-llm'
    );

    // Parse response
    const analysis = this.parseTestAnalysisResponse(response, payload);

    return this.createSuccessResult(task, {
      analysis,
      testResults: payload.testResults,
      coverage: payload.coverage,
    }, startTime);
  }

  // ============================================================================
  // LLM Interaction
  // ============================================================================

  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llmClient.complete(messages, {
      maxTokens: 4000,
      temperature: 0.3,
    });

    return response.content;
  }

  // ============================================================================
  // Prompt Builders
  // ============================================================================

  private buildTestGenerationSystemPrompt(payload: TestGenerationPayload): string {
    return `You are an expert software testing engineer specializing in ${payload.testFramework}.

Your task is to generate comprehensive ${payload.testType} tests for the provided source code.

Guidelines:
- Follow ${payload.testFramework} best practices and conventions
- Create descriptive test names that explain what is being tested
- Include setup and teardown when necessary
- Test both happy paths and edge cases
${payload.mockDependencies ? '- Mock external dependencies appropriately' : ''}
${payload.includeEdgeCases ? '- Include edge cases like null/undefined, empty values, boundary conditions' : ''}

Target coverage thresholds:
- Statements: ${payload.coverage?.statements ?? 80}%
- Branches: ${payload.coverage?.branches ?? 80}%
- Functions: ${payload.coverage?.functions ?? 80}%
- Lines: ${payload.coverage?.lines ?? 80}%

Respond with a JSON object matching this structure:
{
  "testFile": { "path": "string", "content": "string" },
  "testCases": [{ "name": "string", "description": "string", "type": "unit|integration|edge-case" }],
  "mocks": [{ "name": "string", "type": "string", "implementation": "string" }],
  "summary": "string"
}`;
  }

  private buildTestGenerationUserPrompt(payload: TestGenerationPayload): string {
    return `Generate ${payload.testType} tests for the following source file:

File: ${payload.sourceFile}

\`\`\`
${payload.sourceCode}
\`\`\`

Create comprehensive tests that:
1. Test all public functions/methods
2. Cover main execution paths
3. Handle error scenarios
${payload.includeEdgeCases ? '4. Include edge case tests' : ''}`;
  }

  private buildTestAnalysisSystemPrompt(): string {
    return `You are an expert software testing analyst.

Your task is to analyze test results and provide actionable insights.

For each issue found:
- Identify the severity (critical, warning, info)
- Provide a clear message explaining the issue
- Suggest a fix or improvement

Respond with a JSON object matching this structure:
{
  "summary": "string - brief overall assessment",
  "issues": [{ "severity": "critical|warning|info", "message": "string", "suggestion": "string", "testName": "string (optional)" }],
  "recommendations": ["string - actionable recommendations"],
  "coverageAnalysis": { "status": "excellent|good|needs-improvement|critical", "gaps": ["string - uncovered areas"] }
}`;
  }

  private buildTestAnalysisUserPrompt(payload: TestAnalysisPayload): string {
    let prompt = `Analyze the following test results:

Test Summary:
- Total: ${payload.testResults.total}
- Passed: ${payload.testResults.passed}
- Failed: ${payload.testResults.failed}
- Skipped: ${payload.testResults.skipped ?? 0}
- Duration: ${payload.testResults.duration}ms
- Pass Rate: ${((payload.testResults.passed / payload.testResults.total) * 100).toFixed(1)}%
`;

    if (payload.failedTests && payload.failedTests.length > 0) {
      prompt += `\nFailed Tests:\n`;
      for (const test of payload.failedTests) {
        prompt += `- ${test.name} (${test.file ?? 'unknown file'})\n`;
        prompt += `  Error: ${test.error}\n`;
        if (test.stack) {
          prompt += `  Stack: ${test.stack.substring(0, 200)}...\n`;
        }
      }
    }

    if (payload.coverage) {
      prompt += `\nCoverage:
- Statements: ${payload.coverage.statements}%
- Branches: ${payload.coverage.branches}%
- Functions: ${payload.coverage.functions}%
- Lines: ${payload.coverage.lines}%

Coverage Thresholds:
- Statements: ${this.coverageThresholds.statements}%
- Branches: ${this.coverageThresholds.branches}%
- Functions: ${this.coverageThresholds.functions}%
- Lines: ${this.coverageThresholds.lines}%
`;
    }

    return prompt;
  }

  // ============================================================================
  // Response Parsers
  // ============================================================================

  private parseTestGenerationResponse(response: string): GeneratedTestResponse {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = GeneratedTestResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      // Return default structure on validation failure
      this.logger.warn('Test generation response validation failed', {
        errors: validated.error.errors,
      });

      return {
        testFile: {
          path: 'generated.test.ts',
          content: response,
        },
        testCases: [],
        summary: 'Generated tests (parsing incomplete)',
      };
    } catch (error) {
      this.logger.warn('Failed to parse test generation response', { error });

      return {
        testFile: {
          path: 'generated.test.ts',
          content: response,
        },
        testCases: [],
        summary: 'Generated tests (raw response)',
      };
    }
  }

  private parseTestAnalysisResponse(
    response: string,
    payload: TestAnalysisPayload
  ): TestAnalysisResponse {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = TestAnalysisResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      // Return default structure on validation failure
      this.logger.warn('Test analysis response validation failed', {
        errors: validated.error.errors,
      });
    } catch (error) {
      this.logger.warn('Failed to parse test analysis response', { error });
    }

    // Generate default analysis based on payload
    return this.generateDefaultAnalysis(payload);
  }

  private generateDefaultAnalysis(payload: TestAnalysisPayload): TestAnalysisResponse {
    const { testResults, failedTests, coverage } = payload;
    const passRate = testResults.total > 0
      ? (testResults.passed / testResults.total) * 100
      : 0;

    const issues: TestAnalysisResponse['issues'] = [];
    const recommendations: string[] = [];

    // Check for failures
    if (testResults.failed > 0) {
      issues.push({
        severity: 'critical',
        message: `${testResults.failed} test(s) failed`,
        suggestion: 'Review and fix failing tests before merging',
      });
    }

    // Check for failed tests
    if (failedTests && failedTests.length > 0) {
      for (const test of failedTests.slice(0, 3)) {
        issues.push({
          severity: 'critical',
          message: test.error,
          suggestion: 'Fix the test or the underlying code',
          testName: test.name,
        });
      }
    }

    // Check coverage
    let coverageAnalysis: TestAnalysisResponse['coverageAnalysis'] | undefined;
    if (coverage) {
      const gaps: string[] = [];

      if (coverage.statements < this.coverageThresholds.statements) {
        gaps.push(`Statements: ${coverage.statements}% < ${this.coverageThresholds.statements}%`);
      }
      if (coverage.branches < this.coverageThresholds.branches) {
        gaps.push(`Branches: ${coverage.branches}% < ${this.coverageThresholds.branches}%`);
      }
      if (coverage.functions < this.coverageThresholds.functions) {
        gaps.push(`Functions: ${coverage.functions}% < ${this.coverageThresholds.functions}%`);
      }
      if (coverage.lines < this.coverageThresholds.lines) {
        gaps.push(`Lines: ${coverage.lines}% < ${this.coverageThresholds.lines}%`);
      }

      const avgCoverage =
        (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4;

      let status: 'excellent' | 'good' | 'needs-improvement' | 'critical';
      if (avgCoverage >= 90) {
        status = 'excellent';
      } else if (avgCoverage >= 80) {
        status = 'good';
      } else if (avgCoverage >= 60) {
        status = 'needs-improvement';
        issues.push({
          severity: 'warning',
          message: `Test coverage is below threshold (${avgCoverage.toFixed(1)}%)`,
          suggestion: 'Add more tests to improve coverage',
        });
      } else {
        status = 'critical';
        issues.push({
          severity: 'critical',
          message: `Test coverage is critically low (${avgCoverage.toFixed(1)}%)`,
          suggestion: 'Significantly increase test coverage before deployment',
        });
      }

      coverageAnalysis = { status, gaps };
    }

    // Generate recommendations
    if (testResults.failed > 0) {
      recommendations.push('Fix failing tests immediately');
    }
    if (passRate < 100) {
      recommendations.push(`Investigate ${testResults.failed} failed tests`);
    }
    if (coverageAnalysis?.status === 'needs-improvement' || coverageAnalysis?.status === 'critical') {
      recommendations.push('Add tests for uncovered code paths');
    }
    if (testResults.skipped && testResults.skipped > 0) {
      recommendations.push(`Review ${testResults.skipped} skipped tests`);
    }

    return {
      summary: `Test run completed: ${passRate.toFixed(1)}% passed (${testResults.passed}/${testResults.total})`,
      issues,
      recommendations,
      coverageAnalysis,
    };
  }

  // ============================================================================
  // Retry Logic
  // ============================================================================

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );

          this.logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
            attempt,
            maxAttempts: this.retryConfig.maxAttempts,
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a TesterAgent instance
 */
export function createTesterAgent(
  config: TesterAgentConfig,
  dependencies: AgentDependencies
): TesterAgent {
  return new TesterAgent(config, dependencies);
}
