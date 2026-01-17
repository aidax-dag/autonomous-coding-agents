/**
 * Codex CLI Client
 *
 * LLM client that uses the Codex CLI (codex) for completions.
 * Requires Codex CLI to be installed and authenticated.
 *
 * Usage:
 *   - Install: npm install -g @openai/codex
 *   - Authenticate: Run 'codex login' or 'codex' interactively
 */

import { LLMMessage, LLMCompletionOptions, LLMCompletionResult } from '../base-client';
import { BaseCLIClient, CLIExecutionResult } from './base-cli-client';
import { CLIParseError, CLIResponseError } from './errors';

/**
 * Codex CLI JSONL event types
 */
interface CodexThreadStartedEvent {
  type: 'thread.started';
  thread_id: string;
}

interface CodexTurnStartedEvent {
  type: 'turn.started';
}

interface CodexItemCompletedEvent {
  type: 'item.completed';
  item: {
    id: string;
    type: 'reasoning' | 'agent_message' | 'tool_call' | string;
    text?: string;
  };
}

interface CodexTurnCompletedEvent {
  type: 'turn.completed';
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

interface CodexErrorEvent {
  type: 'error';
  error: string;
}

type CodexEvent =
  | CodexThreadStartedEvent
  | CodexTurnStartedEvent
  | CodexItemCompletedEvent
  | CodexTurnCompletedEvent
  | CodexErrorEvent;

/**
 * Default model for Codex CLI
 */
const DEFAULT_MODEL = 'o3';

/**
 * Context length mapping
 */
const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  o3: 128000,
  'o3-mini': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4': 128000,
};

/**
 * Codex CLI Client
 */
export class CodexCLIClient extends BaseCLIClient {
  protected readonly cliCommand = 'codex';
  protected readonly providerName = 'codex-cli';
  protected readonly defaultContextLength = 128000;

  constructor(defaultModel?: string) {
    super(defaultModel);
  }

  protected getDefaultModelForProvider(): string {
    return DEFAULT_MODEL;
  }

  /**
   * Build CLI arguments for Codex
   */
  protected buildArgs(_messages: LLMMessage[], options?: LLMCompletionOptions): string[] {
    const args: string[] = [
      'exec', // Non-interactive execution mode
      '--json', // JSONL output
      '--skip-git-repo-check', // Allow running outside git repos
    ];

    // Add model if specified
    const model = this.getModel(options);
    if (model) {
      args.push('-m', model);
    }

    // Use '-' to read prompt from stdin
    args.push('-');

    return args;
  }

  /**
   * Get input for Codex CLI (prompt via stdin)
   */
  protected getInputForCommand(messages: LLMMessage[]): string | undefined {
    // Codex exec takes the prompt from stdin when using '-'
    // Combine system prompt and user message
    const systemPrompt = this.extractSystemPrompt(messages);
    const userMessage = this.extractLastUserMessage(messages);

    if (systemPrompt) {
      return `${systemPrompt}\n\n${userMessage}`;
    }
    return userMessage;
  }

  /**
   * Parse Codex CLI JSONL response
   */
  protected parseResponse(output: string): LLMCompletionResult {
    try {
      const lines = output.split('\n').filter((line) => line.trim());
      const events: CodexEvent[] = [];

      // Parse each JSONL line
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as CodexEvent;
          events.push(event);
        } catch {
          // Skip non-JSON lines
          continue;
        }
      }

      if (events.length === 0) {
        throw new Error('No valid JSONL events found in output');
      }

      // Extract response from agent_message events
      let content = '';
      let threadId: string | undefined;
      let inputTokens = 0;
      let outputTokens = 0;

      for (const event of events) {
        switch (event.type) {
          case 'thread.started':
            threadId = event.thread_id;
            break;

          case 'item.completed':
            if (event.item.type === 'agent_message' && event.item.text) {
              content += event.item.text;
            }
            break;

          case 'turn.completed':
            if (event.usage) {
              inputTokens = (event.usage.input_tokens || 0) + (event.usage.cached_input_tokens || 0);
              outputTokens = event.usage.output_tokens || 0;
            }
            break;

          case 'error':
            throw new CLIResponseError(this.cliCommand, event.error);
        }
      }

      if (!content) {
        // Try to find any text content
        for (const event of events) {
          if (event.type === 'item.completed' && event.item.text) {
            content = event.item.text;
            break;
          }
        }
      }

      return {
        content: content.trim(),
        model: this.defaultModel,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        finishReason: 'stop',
        metadata: {
          threadId,
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
      'invalid api key',
      'invalid token',
      'expired',
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
    // Check for error events in JSONL output
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'error') {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Get maximum context length for model
   */
  getMaxContextLength(model?: string): number {
    const modelName = model || this.defaultModel;
    return MODEL_CONTEXT_LENGTHS[modelName] || this.defaultContextLength;
  }
}
