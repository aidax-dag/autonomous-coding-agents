/**
 * Team Agent LLM Adapter
 *
 * Provides LLM integration for team agents with structured output parsing.
 * Adapts ILLMClient for use with team-specific task processing.
 *
 * Feature: LLM Integration for Agent OS
 */

import { z } from 'zod';
import {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  createSystemMessage,
  createUserMessage,
} from '@/shared/llm';
import { TaskDocument } from '../../workspace/task-document';

/**
 * LLM response with parsed output
 */
export interface LLMParsedResponse<T> {
  /** Parsed structured output */
  parsed: T;
  /** Raw response content */
  raw: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Model used */
  model: string;
}

/**
 * LLM adapter configuration
 */
export interface TeamAgentLLMConfig {
  /** LLM client to use */
  client: ILLMClient;
  /** Default model to use */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
  /** Retry attempts on failure */
  retryAttempts?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

/**
 * Prompt context for LLM calls
 */
export interface PromptContext {
  /** The task to process */
  task: TaskDocument;
  /** Additional context from project */
  projectContext?: string;
  /** Previous conversation for context */
  conversationHistory?: LLMMessage[];
  /** Constraints or requirements */
  constraints?: string[];
}

/**
 * Team Agent LLM Adapter
 *
 * Provides structured LLM integration for team agents.
 */
export class TeamAgentLLMAdapter {
  private client: ILLMClient;
  private config: Required<Omit<TeamAgentLLMConfig, 'client'>>;

  constructor(config: TeamAgentLLMConfig) {
    this.client = config.client;
    this.config = {
      model: config.model || config.client.getDefaultModel(),
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  /**
   * Get the underlying LLM client
   */
  getClient(): ILLMClient {
    return this.client;
  }

  /**
   * Execute LLM call with structured output parsing
   */
  async execute<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
    options?: Partial<LLMCompletionOptions>
  ): Promise<LLMParsedResponse<T>> {
    const messages: LLMMessage[] = [
      createSystemMessage(systemPrompt),
      createUserMessage(userPrompt),
    ];

    const result = await this.executeWithRetry(messages, options);
    const parsed = this.parseResponse(result.content, schema);

    return {
      parsed,
      raw: result.content,
      usage: result.usage,
      model: result.model,
    };
  }

  /**
   * Execute LLM call without parsing (raw response)
   */
  async executeRaw(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<LLMCompletionOptions>
  ): Promise<LLMCompletionResult> {
    const messages: LLMMessage[] = [
      createSystemMessage(systemPrompt),
      createUserMessage(userPrompt),
    ];

    return this.executeWithRetry(messages, options);
  }

  /**
   * Execute with conversation history
   */
  async executeWithHistory<T>(
    systemPrompt: string,
    history: LLMMessage[],
    schema: z.ZodSchema<T>,
    options?: Partial<LLMCompletionOptions>
  ): Promise<LLMParsedResponse<T>> {
    const messages: LLMMessage[] = [
      createSystemMessage(systemPrompt),
      ...history,
    ];

    const result = await this.executeWithRetry(messages, options);
    const parsed = this.parseResponse(result.content, schema);

    return {
      parsed,
      raw: result.content,
      usage: result.usage,
      model: result.model,
    };
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    messages: LLMMessage[],
    options?: Partial<LLMCompletionOptions>
  ): Promise<LLMCompletionResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        return await this.client.chat(messages, {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          ...options,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          throw lastError;
        }

        // Wait before retry
        if (attempt < this.config.retryAttempts - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('LLM execution failed after retries');
  }

  /**
   * Parse response content with schema validation
   */
  private parseResponse<T>(content: string, schema: z.ZodSchema<T>): T {
    // Try to extract JSON from response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    const jsonContent = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      // Parse JSON
      const parsed = JSON.parse(jsonContent);

      // Validate with schema
      return schema.parse(parsed);
    } catch (error) {
      // Try to parse as plain text if JSON fails
      try {
        return schema.parse(content);
      } catch {
        throw new Error(
          `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Rate limit errors
      if (error.name === 'LLMRateLimitError') {
        return true;
      }
      // Server errors (5xx)
      if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        return true;
      }
      // Timeout errors
      if (error.name === 'LLMTimeoutError' || error.message.includes('timeout')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Format task for LLM prompt
 */
export function formatTaskForPrompt(task: TaskDocument): string {
  const parts: string[] = [
    `## Task: ${task.metadata.title}`,
    '',
    `**Type**: ${task.metadata.type}`,
    `**Priority**: ${task.metadata.priority}`,
    `**From**: ${task.metadata.from}`,
  ];

  if (task.metadata.tags.length > 0) {
    parts.push(`**Tags**: ${task.metadata.tags.join(', ')}`);
  }

  parts.push('', '### Description', '', task.content);

  if (task.metadata.files && task.metadata.files.length > 0) {
    parts.push('', '### Related Files', '');
    for (const file of task.metadata.files) {
      parts.push(`- \`${file.path}\` (${file.action}): ${file.description || 'No description'}`);
    }
  }

  return parts.join('\n');
}

/**
 * Create LLM adapter from configuration
 */
export function createTeamAgentLLMAdapter(config: TeamAgentLLMConfig): TeamAgentLLMAdapter {
  return new TeamAgentLLMAdapter(config);
}
