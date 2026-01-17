/**
 * Base CLI LLM Client
 *
 * Abstract base class for CLI-based LLM clients.
 * Provides common functionality for executing CLI commands and parsing responses.
 */

import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
  LLMStreamChunk,
} from '../base-client';
import {
  CLINotFoundError,
  CLITimeoutError,
  CLIResponseError,
  CLIParseError,
  CLIAuthenticationError,
} from './errors';

const execAsync = promisify(exec);

/**
 * CLI availability status
 */
export interface CLIAvailability {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * CLI execution result
 */
export interface CLIExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Default timeout for CLI execution (2 minutes)
 */
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Abstract base class for CLI-based LLM clients
 */
export abstract class BaseCLIClient implements ILLMClient {
  protected defaultModel: string;

  /**
   * The CLI command to execute (e.g., 'claude', 'codex', 'gemini')
   */
  protected abstract readonly cliCommand: string;

  /**
   * Provider identifier
   */
  protected abstract readonly providerName: string;

  /**
   * Default context length
   */
  protected abstract readonly defaultContextLength: number;

  constructor(defaultModel?: string) {
    this.defaultModel = defaultModel || this.getDefaultModelForProvider();
  }

  /**
   * Get the default model for this provider
   */
  protected abstract getDefaultModelForProvider(): string;

  /**
   * Build CLI arguments from messages and options
   */
  protected abstract buildArgs(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): string[];

  /**
   * Parse CLI output into LLMCompletionResult
   */
  protected abstract parseResponse(output: string): LLMCompletionResult;

  /**
   * Check if error indicates authentication failure
   */
  protected abstract isAuthenticationError(error: string): boolean;

  /**
   * Check if error indicates rate limit
   */
  protected abstract isRateLimitError(error: string): boolean;

  /**
   * Get provider name
   */
  getProvider(): string {
    return this.providerName;
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Get maximum context length
   */
  getMaxContextLength(_model?: string): number {
    return this.defaultContextLength;
  }

  /**
   * Check if CLI is available
   */
  async checkAvailability(): Promise<CLIAvailability> {
    try {
      // Check if CLI exists
      const { stdout: whichOutput } = await execAsync(`which ${this.cliCommand}`);
      const path = whichOutput.trim();

      // Get version
      try {
        const { stdout: versionOutput } = await execAsync(`${this.cliCommand} --version`);
        const version = versionOutput.trim().split('\n')[0];

        return {
          available: true,
          version,
          path,
        };
      } catch {
        // Version check failed but CLI exists
        return {
          available: true,
          path,
        };
      }
    } catch {
      return {
        available: false,
        error: `CLI '${this.cliCommand}' not found`,
      };
    }
  }

  /**
   * Execute CLI command
   */
  protected async executeCommand(
    args: string[],
    input?: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<CLIExecutionResult> {
    // First check if CLI is available
    const availability = await this.checkAvailability();
    if (!availability.available) {
      throw new CLINotFoundError(this.cliCommand);
    }

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc: ChildProcess = spawn(this.cliCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      // Setup timeout
      const timeout = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        reject(new CLITimeoutError(this.cliCommand, timeoutMs));
      }, timeoutMs);

      // Collect stdout
      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Collect stderr
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process exit
      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (killed) {
          return; // Already rejected by timeout
        }

        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });

      // Handle process error
      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(new CLIResponseError(this.cliCommand, error.message));
      });

      // Send input if provided
      if (input && proc.stdin) {
        proc.stdin.write(input);
        proc.stdin.end();
      } else if (proc.stdin) {
        proc.stdin.end();
      }
    });
  }

  /**
   * Format messages into a single prompt string
   */
  protected formatMessagesAsPrompt(messages: LLMMessage[]): string {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    let prompt = '';

    // Add system messages as context
    if (systemMessages.length > 0) {
      prompt += systemMessages.map((m) => m.content).join('\n\n');
      prompt += '\n\n';
    }

    // Add conversation
    for (const msg of conversationMessages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    }

    // Remove the last user prefix if the last message is from user
    // (CLI will respond to it directly)
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    if (lastMessage?.role === 'user') {
      prompt = prompt.slice(0, -('\n\n'.length));
    }

    return prompt.trim();
  }

  /**
   * Extract system prompt from messages
   */
  protected extractSystemPrompt(messages: LLMMessage[]): string | undefined {
    const systemMessages = messages.filter((m) => m.role === 'system');
    if (systemMessages.length === 0) {
      return undefined;
    }
    return systemMessages.map((m) => m.content).join('\n\n');
  }

  /**
   * Extract last user message
   */
  protected extractLastUserMessage(messages: LLMMessage[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      throw new Error('No user message found in messages');
    }
    return userMessages[userMessages.length - 1].content;
  }

  /**
   * Chat completion
   */
  async chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    this.validateMessages(messages);

    const args = this.buildArgs(messages, options);
    const input = this.getInputForCommand(messages);
    const timeoutMs = options?.timeout || DEFAULT_TIMEOUT_MS;

    try {
      const result = await this.executeCommand(args, input, timeoutMs);

      // Check for errors in stderr or non-zero exit code
      if (result.exitCode !== 0 || this.hasErrorInOutput(result)) {
        const errorOutput = result.stderr || result.stdout;

        if (this.isAuthenticationError(errorOutput)) {
          throw new CLIAuthenticationError(this.cliCommand, errorOutput);
        }

        if (this.isRateLimitError(errorOutput)) {
          throw new CLIResponseError(this.cliCommand, 'Rate limit exceeded', result.exitCode);
        }

        throw new CLIResponseError(this.cliCommand, errorOutput, result.exitCode);
      }

      return this.parseResponse(result.stdout);
    } catch (error) {
      if (
        error instanceof CLINotFoundError ||
        error instanceof CLITimeoutError ||
        error instanceof CLIAuthenticationError ||
        error instanceof CLIResponseError ||
        error instanceof CLIParseError
      ) {
        throw error;
      }
      throw new CLIResponseError(
        this.cliCommand,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Chat completion with streaming
   * Note: Most CLI implementations will return the full response,
   * subclasses can override for true streaming support
   */
  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    // Default implementation: get full response and emit as single chunk
    const result = await this.chat(messages, options);

    // Emit content as chunk
    const chunk: LLMStreamChunk = {
      content: result.content,
      isComplete: false,
    };
    await callback(chunk);

    // Emit completion
    const completeChunk: LLMStreamChunk = {
      content: '',
      isComplete: true,
      usage: result.usage,
    };
    await callback(completeChunk);

    return result;
  }

  /**
   * Get input to send to CLI stdin (if needed)
   * Override in subclasses if the CLI accepts input via stdin
   */
  protected getInputForCommand(_messages: LLMMessage[]): string | undefined {
    return undefined;
  }

  /**
   * Check if output contains error indicators
   * Override in subclasses for provider-specific error detection
   */
  protected hasErrorInOutput(_result: CLIExecutionResult): boolean {
    return false;
  }

  /**
   * Validate messages
   */
  protected validateMessages(messages: LLMMessage[]): void {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const message of messages) {
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
      if (typeof message.content !== 'string') {
        throw new Error('Message content must be a string');
      }
    }
  }

  /**
   * Get model name with fallback to default
   */
  protected getModel(options?: LLMCompletionOptions): string {
    return options?.model || this.defaultModel;
  }
}
