/**
 * Claude CLI Client
 *
 * LLM client that uses the Claude CLI (claude) for completions.
 * Requires Claude CLI to be installed and authenticated.
 *
 * Usage:
 *   - Install: npm install -g @anthropic-ai/claude-code
 *   - Authenticate: Run 'claude' interactively to login
 */

import { LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../base-client';
import { BaseCLIClient, CLIExecutionResult } from './base-cli-client';
import { CLIParseError, CLIResponseError } from './errors';

/**
 * Claude CLI JSON response structure
 */
interface ClaudeCLIResponse {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  result: string;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<
    string,
    {
      inputTokens?: number;
      outputTokens?: number;
      cacheReadInputTokens?: number;
      cacheCreationInputTokens?: number;
    }
  >;
}

/**
 * Default model for Claude CLI
 */
const DEFAULT_MODEL = 'sonnet';

/**
 * Context length mapping
 */
const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  opus: 200000,
  sonnet: 200000,
  haiku: 200000,
  'claude-opus-4-5': 200000,
  'claude-sonnet-4': 200000,
  'claude-haiku-4': 200000,
};

/**
 * Claude CLI Client
 */
export class ClaudeCLIClient extends BaseCLIClient {
  protected readonly cliCommand = 'claude';
  protected readonly providerName = 'claude-cli';
  protected readonly defaultContextLength = 200000;

  constructor(defaultModel?: string) {
    super(defaultModel);
  }

  protected getDefaultModelForProvider(): string {
    return DEFAULT_MODEL;
  }

  /**
   * Build CLI arguments for Claude
   */
  protected buildArgs(messages: LLMMessage[], options?: LLMCompletionOptions): string[] {
    const args: string[] = [
      '-p', // Non-interactive print mode
      '--output-format',
      'json', // JSON output
    ];

    // Add model if specified
    const model = this.getModel(options);
    if (model) {
      args.push('--model', model);
    }

    // Add system prompt if present
    const systemPrompt = this.extractSystemPrompt(messages);
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Add max tokens if specified
    if (options?.maxTokens) {
      args.push('--max-budget-usd', String(options.maxTokens / 1000)); // Rough conversion
    }

    return args;
  }

  /**
   * Get input for Claude CLI (user message via stdin)
   */
  protected getInputForCommand(messages: LLMMessage[]): string | undefined {
    // Claude CLI takes the prompt from stdin when using -p
    return this.extractLastUserMessage(messages);
  }

  /**
   * Parse Claude CLI JSON response
   */
  protected parseResponse(output: string): LLMCompletionResult {
    try {
      // Find JSON in output (might have other text before/after)
      const jsonMatch = output.match(/\{[\s\S]*"type"\s*:\s*"result"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON result found in output');
      }

      const response: ClaudeCLIResponse = JSON.parse(jsonMatch[0]);

      // Check for error response
      if (response.is_error || response.subtype === 'error') {
        throw new CLIResponseError(this.cliCommand, response.result);
      }

      // Calculate token usage
      let inputTokens = response.usage?.input_tokens || 0;
      let outputTokens = response.usage?.output_tokens || 0;

      // If modelUsage is present, aggregate from all models
      if (response.modelUsage) {
        inputTokens = 0;
        outputTokens = 0;
        for (const modelStats of Object.values(response.modelUsage)) {
          inputTokens += modelStats.inputTokens || 0;
          outputTokens += modelStats.outputTokens || 0;
        }
      }

      return {
        content: response.result,
        model: this.defaultModel,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        finishReason: 'stop',
        metadata: {
          sessionId: response.session_id,
          totalCostUsd: response.total_cost_usd,
          durationMs: response.duration_ms,
          numTurns: response.num_turns,
        },
      };
    } catch (error) {
      if (error instanceof CLIResponseError) {
        throw error;
      }
      throw new CLIParseError(this.cliCommand, output, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Check if error indicates authentication failure
   */
  protected isAuthenticationError(error: string): boolean {
    const authPatterns = [
      'not authenticated',
      'authentication failed',
      'please login',
      'unauthorized',
      'invalid token',
      'expired token',
    ];
    const lowerError = error.toLowerCase();
    return authPatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Check if error indicates rate limit
   */
  protected isRateLimitError(error: string): boolean {
    const rateLimitPatterns = ['rate limit', 'too many requests', '429', 'quota exceeded'];
    const lowerError = error.toLowerCase();
    return rateLimitPatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Check if output contains error indicators
   */
  protected hasErrorInOutput(result: CLIExecutionResult): boolean {
    try {
      const jsonMatch = result.stdout.match(/\{[\s\S]*"type"\s*:\s*"result"[\s\S]*\}/);
      if (jsonMatch) {
        const response: ClaudeCLIResponse = JSON.parse(jsonMatch[0]);
        return response.is_error === true;
      }
    } catch {
      // If parsing fails, check stderr
    }
    return result.stderr.length > 0 && !result.stderr.includes('warning');
  }

  /**
   * Get maximum context length for model
   */
  getMaxContextLength(model?: string): number {
    const modelName = model || this.defaultModel;
    return MODEL_CONTEXT_LENGTHS[modelName] || this.defaultContextLength;
  }
}
