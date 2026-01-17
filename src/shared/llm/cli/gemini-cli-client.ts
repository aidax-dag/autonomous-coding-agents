/**
 * Gemini CLI Client
 *
 * LLM client that uses the Gemini CLI (gemini) for completions.
 * Requires Gemini CLI to be installed and authenticated.
 *
 * Usage:
 *   - Install: npm install -g @anthropic-ai/gemini-cli (or via Google's package)
 *   - Authenticate: Run 'gemini' interactively to login with Google account
 */

import { LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../base-client';
import { BaseCLIClient, CLIExecutionResult } from './base-cli-client';
import { CLIParseError, CLIResponseError } from './errors';

/**
 * Gemini CLI JSON response structure
 */
interface GeminiCLIResponse {
  response?: string;
  error?: string;
  stats?: {
    models?: Record<
      string,
      {
        tokens?: {
          input?: number;
          output?: number;
        };
      }
    >;
    totalDuration?: number;
  };
}

/**
 * Default model for Gemini CLI
 */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Context length mapping
 */
const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  'gemini-2.0-flash': 1000000,
  'gemini-2.0-flash-lite': 1000000,
  'gemini-1.5-pro': 2000000,
  'gemini-1.5-flash': 1000000,
  'gemini-1.5-flash-8b': 1000000,
};

/**
 * Gemini CLI Client
 */
export class GeminiCLIClient extends BaseCLIClient {
  protected readonly cliCommand = 'gemini';
  protected readonly providerName = 'gemini-cli';
  protected readonly defaultContextLength = 1000000;

  constructor(defaultModel?: string) {
    super(defaultModel);
  }

  protected getDefaultModelForProvider(): string {
    return DEFAULT_MODEL;
  }

  /**
   * Build CLI arguments for Gemini
   */
  protected buildArgs(_messages: LLMMessage[], options?: LLMCompletionOptions): string[] {
    const args: string[] = [
      '-o',
      'json', // JSON output format
    ];

    // Add model if specified
    const model = this.getModel(options);
    if (model) {
      args.push('-m', model);
    }

    return args;
  }

  /**
   * Get input for Gemini CLI (prompt via stdin)
   */
  protected getInputForCommand(messages: LLMMessage[]): string | undefined {
    // Gemini CLI takes the prompt from stdin
    // Combine system prompt and user message
    const systemPrompt = this.extractSystemPrompt(messages);
    const userMessage = this.extractLastUserMessage(messages);

    if (systemPrompt) {
      return `System: ${systemPrompt}\n\nUser: ${userMessage}`;
    }
    return userMessage;
  }

  /**
   * Parse Gemini CLI JSON response
   */
  protected parseResponse(output: string): LLMCompletionResult {
    try {
      // Find JSON in output (might have other text before/after)
      const jsonMatch = output.match(/\{[\s\S]*"response"[\s\S]*\}|\{[\s\S]*"error"[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to find any valid JSON object
        const anyJsonMatch = output.match(/\{[\s\S]*\}/);
        if (!anyJsonMatch) {
          throw new Error('No JSON found in output');
        }
        // If we find JSON but no response field, treat entire output as response
        return {
          content: output.trim(),
          model: this.defaultModel,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          finishReason: 'stop',
        };
      }

      const response: GeminiCLIResponse = JSON.parse(jsonMatch[0]);

      // Check for error response
      if (response.error) {
        throw new CLIResponseError(this.cliCommand, response.error);
      }

      // Calculate token usage from stats
      let inputTokens = 0;
      let outputTokens = 0;

      if (response.stats?.models) {
        for (const modelStats of Object.values(response.stats.models)) {
          if (modelStats.tokens) {
            inputTokens += modelStats.tokens.input || 0;
            outputTokens += modelStats.tokens.output || 0;
          }
        }
      }

      return {
        content: response.response || '',
        model: this.defaultModel,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        finishReason: 'stop',
        metadata: {
          totalDuration: response.stats?.totalDuration,
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
      'invalid credentials',
      'sign in',
      'google account',
    ];
    const lowerError = error.toLowerCase();
    return authPatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Check if error indicates rate limit
   */
  protected isRateLimitError(error: string): boolean {
    const rateLimitPatterns = ['rate limit', 'too many requests', '429', 'quota exceeded', 'resource exhausted'];
    const lowerError = error.toLowerCase();
    return rateLimitPatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Check if output contains error indicators
   */
  protected hasErrorInOutput(result: CLIExecutionResult): boolean {
    try {
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const response: GeminiCLIResponse = JSON.parse(jsonMatch[0]);
        return !!response.error;
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
